import ChatModel from "src/models/Chat";
import { IChat, IChatResult, IChatSource } from "src/models/Chat";
import { ConversationService } from "./ConversationService";
import mongoose from "mongoose";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { GLOBAL_CONFIG, OPENROUTER_API_KEY } from 'src/settings';
import { RagRetrievalService } from "src/rag/retrieval/services/RagRetrievalService";
import { EmbeddingService } from "src/rag/ingestion/services/EmbeddingService";
import { PineconeIndexService } from "src/rag/ingestion/services/PineconeIndexService";
import { RetrievedChunk } from "src/rag/retrieval/types/retrieval.types";
import { ERICA_SYSTEM_PROMPT } from "src/rag/shared/prompts/ericaSystemPrompt";

type ChatStatus = "queued" | "processing" | "completed" | "failed";

type ProcessPayload = {
  answer?: string;
  sources?: IChatSource[];
  retrievalMeta?: IChatResult["retrievalMeta"];
};

type TaskUpdateData = Partial<{
  status: ChatStatus;
  progress: string;
  displayMessage: string;
  answer: string;
  error: string;
  result: IChatResult;
}>;

export interface ChatTask {
  status: ChatStatus;
  progress: string;
  displayMessage: string;
  result?: IChatResult | string;
  error?: string;
}

export class ChatService {
  private static instance: ChatService;

  private conversationService = ConversationService.getInstance();
  private ragRetrievalService = new RagRetrievalService(
    new EmbeddingService(),
    new PineconeIndexService()
  );

  private constructor() { }

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  private ensureDbReady(): void {
    if (!(mongoose.connection.readyState === 1)) {
      throw new Error("Database connection is not ready");
    }
  }

  private async updateTask(taskId: string, data: TaskUpdateData): Promise<void> {
    this.ensureDbReady();
    await ChatModel.findByIdAndUpdate(taskId, data);
  }

  private async getTask(taskId: string): Promise<IChat | null> {
    this.ensureDbReady();
    return ChatModel.findById(taskId);
  }

  private async createTask(query: string, userId?: string, conversationId?: string): Promise<string> {
    const initialData = {
      query,
      userId,
      conversationId,
      status: "queued",
      progress: "init",
      displayMessage: "Analyzing question...",
    };

    this.ensureDbReady();
    const chat = await ChatModel.create(initialData);
    return chat._id.toString();
  }

  private buildContextText(chunks: RetrievedChunk[], maxChunks = 4): string {
    const selected = chunks.slice(0, maxChunks);

    if (selected.length === 0) {
      return "";
    }

    return selected
      .map((chunk, index) => {
        return [
          `[CONTEXT ${index + 1}]`,
          `documentId: ${chunk.documentId}`,
          `chunkId: ${chunk.chunkId}`,
          `chunkIndex: ${chunk.chunkIndex}`,
          `score: ${chunk.score.toFixed(4)}`,
          `fileName: ${chunk.fileName ?? "unknown"}`,
          chunk.text ? `text: ${chunk.text}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");
  }

  private async callGroundedLLM(query: string, contextText: string): Promise<string> {
    const apiKey = OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("Missing LLM API key");
    }

    const chat = new ChatOpenAI({
      apiKey,
      modelName: GLOBAL_CONFIG.chatModel,
      temperature: 0.2,
      configuration: {
        baseURL: GLOBAL_CONFIG.llmBaseUrl,
      },
    });

    const systemPrompt = ERICA_SYSTEM_PROMPT;
    const userPrompt = [
      `Question: ${query}`,
      "",
      "Context:",
      contextText || "(no relevant context found)",
    ].join("\n");

    const response = await chat.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    return typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);
  }

  private async processChatTask(taskId: string, query: string, userId?: string, conversationId?: string) {
    // helper function
    const update = async (
      progress: string,
      msg: string,
      payload?: ProcessPayload
    ): Promise<void> => {
      const updateData: TaskUpdateData = {
        status: progress === "done" ? "completed" : "processing",
        progress,
        displayMessage: msg,
      };

      if (payload?.answer !== undefined ) {
        updateData.answer = payload.answer;
      }

      if (payload?.sources || payload?.retrievalMeta) {
        updateData.result = {
          answer: payload.answer ?? "",
          sources: payload.sources ?? [],
          retrievalMeta: payload.retrievalMeta ?? { topK: 0, usedChunks: 0},
        };
      }

      await this.updateTask(taskId, updateData);
    }

    try {
      await update("embedding_query", "Embedding user query...");
      await update("retrieving_chunks", "Retrieving relevant chunks...");

      const retrieval = await this.ragRetrievalService.retrieveContext({
        query,
        topK: 5,
        minScore: 0.0,
      });

      await update("building_context", "Building context for answer...");
      const contextText = this.buildContextText(retrieval.chunks, 4);

      await update("generating_answer", "Generating grounded answer...");
      const answer = await this.callGroundedLLM(query, contextText);

      const sources = retrieval.chunks.slice(0, 4).map((chunk) => ({
        documentId: chunk.documentId,
        fileName: chunk.fileName,
        chunkId: chunk.chunkId,
        chunkIndex: chunk.chunkIndex,
        score: chunk.score,
      }));

      await update("done", "Completed", {
        answer,
        sources,
        retrievalMeta: {
          topK: retrieval.topK,
          usedChunks: retrieval.usedChunks,
        },
      });
      
      if (userId && conversationId) {
        await this.conversationService.touchConversation(userId, conversationId);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await this.updateTask(taskId, {
        status: "failed",
        progress: "error",
        displayMessage: "An error occurred.",
        error: message,
      });
    }
  }

  public async startChatTask(
    query: string,
    userId?: string,
    conversationId?: string
  ): Promise<{ taskId: string; message: string; conversationId?: string }> {
    let resolvedConversationId = conversationId;

    if (userId) {
      if (resolvedConversationId) {
        await this.conversationService.ensureOwnership(userId, resolvedConversationId);
      } else {
        const created = await this.conversationService.createConversation(userId, query.slice(0, 50));
        resolvedConversationId = created.conversationId;
      }
    }

    const taskId = await this.createTask(query, userId, resolvedConversationId);
    void this.processChatTask(taskId, query, userId, resolvedConversationId);

    return { taskId, message: "Started", conversationId: resolvedConversationId };
  }

  public async getTaskStatus(taskId: string): Promise<ChatTask | undefined> {
    const chat = await this.getTask(taskId);

    if (!chat) return undefined;

    return {
      status: chat.status,
      progress: chat.progress,
      displayMessage: chat.displayMessage,
      result: chat.result ?? chat.answer,
      error: chat.error,
    };
  }
}
