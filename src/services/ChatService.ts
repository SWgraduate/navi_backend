import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { GLOBAL_CONFIG, OPENROUTER_API_KEY } from 'src/settings';
import ChatModel from "src/models/Chat";
import mongoose from "mongoose";
import { RagRetrievalService } from "src/rag/retrieval/services/RagRetrievalService";
import { RetrievedChunk } from "src/rag/retrieval/types/retrieval.types";
import { ERICA_SYSTEM_PROMPT } from "src/rag/shared/prompts/ericaSystemPrompt";

export interface ChatTask {
  status: "queued" | "processing" | "completed" | "failed";
  progress: string;
  displayMessage: string;
  result?: any;
  error?: string;
}

export class ChatService {
  private static instance: ChatService;
  private ragRetrievalService = new RagRetrievalService();

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

  private async updateTask(taskId: string, data: Record<string, any>): Promise<void> {
    this.ensureDbReady();
    await ChatModel.findByIdAndUpdate(taskId, data);
  }

  private async getTask(taskId: string): Promise<any> {
    this.ensureDbReady();
    return ChatModel.findById(taskId);
  }

  private async createTask(query: string): Promise<string> {
    const initialData = {
      query,
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

  private async processChatTask(taskId: string, query: string) {
    const update = async (
      progress: string,
      msg: string,
      payload?: { answer?: string; sources?: any[]; retrievalMeta?: any }
    ) => {
      const updateData: any = {
        status: progress === "done" ? "completed" : "processing",
        progress,
        displayMessage: msg,
      };

      if (payload?.answer !== undefined) {
        updateData.answer = payload.answer;
      }

      if (payload?.sources || payload?.retrievalMeta) {
        updateData.result = {
          answer: payload.answer,
          sources: payload.sources ?? [],
          retrievalMeta: payload.retrievalMeta ?? {},
        };
      }

      await this.updateTask(taskId, updateData);
    };

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
    } catch (err: any) {
      await this.updateTask(taskId, {
        status: "failed",
        progress: "error",
        displayMessage: "An error occurred.",
        error: err?.message || String(err),
      });
    }
  }

  public async startChatTask(query: string): Promise<{ taskId: string; message: string }> {
    const taskId = await this.createTask(query);

    this.processChatTask(taskId, query);
    return { taskId, message: "Started" };
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
