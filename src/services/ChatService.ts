import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
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
}

export class ChatService {
  private static instance: ChatService;
  private inMemoryStore = new Map<string, any>();
  private ragRetrievalService = new RagRetrievalService();

  private constructor() {}

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  private isDbReady(): boolean {
    return mongoose.connection.readyState === 1;
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
    const apiKey = process.env.LLM_TOKEN || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing LLM API key");
    }

    const chat = new ChatOpenAI({
      apiKey,
      modelName: process.env.LLM_MODEL ?? "xiaomi/mimo-v2-flash",
      temperature: 0.2,
      configuration: {
        baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
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

      if (payload?.answer) {
        updateData.answer = payload.answer;
      }

      if (payload?.sources || payload?.retrievalMeta) {
        updateData.result = {
          answer: payload.answer,
          sources: payload.sources ?? [],
          retrievalMeta: payload.retrievalMeta ?? {},
        };
      }

      if (this.isDbReady()) {
        await ChatModel.findByIdAndUpdate(taskId, updateData);
      } else {
        const existing = this.inMemoryStore.get(taskId);
        this.inMemoryStore.set(taskId, { ...existing, ...updateData });
      }
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
      const errorData = {
        status: "failed",
        progress: "error",
        displayMessage: "An error occurred.",
        error: err?.message || String(err),
      };

      if (this.isDbReady()) {
        await ChatModel.findByIdAndUpdate(taskId, errorData);
      } else {
        const existing = this.inMemoryStore.get(taskId);
        this.inMemoryStore.set(taskId, { ...existing, ...errorData });
      }
    }
  }

  public async startChatTask(query: string): Promise<{ taskId: string; message: string }> {
    let taskId: string;

    if (this.isDbReady()) {
      const chat = await ChatModel.create({
        query,
        status: "queued",
        progress: "init",
        displayMessage: "Analyzing question...",
      });
      taskId = chat._id.toString();
    } else {
      taskId = Date.now().toString();
      this.inMemoryStore.set(taskId, {
        _id: taskId,
        query,
        status: "queued",
        progress: "init",
        displayMessage: "Analyzing question...",
      });
    }

    this.processChatTask(taskId, query);
    return { taskId, message: "Started" };
  }

  public async getTaskStatus(taskId: string): Promise<ChatTask | undefined> {
    let chat: any;

    if (this.isDbReady()) {
      chat = await ChatModel.findById(taskId);
    } else {
      chat = this.inMemoryStore.get(taskId);
    }

    if (!chat) return undefined;

    return {
      status: chat.status,
      progress: chat.progress,
      displayMessage: chat.displayMessage,
      result: chat.result ?? chat.answer,
    };
  }
}
