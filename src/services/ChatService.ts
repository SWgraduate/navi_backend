import ChatModel from "src/models/Chat";
import { IChat, IChatResult, IChatSource } from "src/models/Chat";
import { ConversationService } from "./ConversationService";
import mongoose from "mongoose";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { GLOBAL_CONFIG, OPENROUTER_API_KEY, ENABLE_FILE_AWARE_CHAT } from 'src/settings';
import { RagRetrievalService } from "src/rag/retrieval/services/RagRetrievalService";
import { EmbeddingService } from "src/rag/ingestion/services/EmbeddingService";
import { PineconeIndexService } from "src/rag/ingestion/services/PineconeIndexService";
import { RetrievedChunk } from "src/rag/retrieval/types/retrieval.types";
import { ERICA_SYSTEM_PROMPT } from "src/rag/shared/prompts/ericaSystemPrompt";
import { AttachmentContextService } from "./AttachmentContextService";

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
  private attachmentContextService = AttachmentContextService.getInstance();
  private ragRetrievalService = new RagRetrievalService(
    new EmbeddingService(),
    new PineconeIndexService()
  );

  private constructor() {}

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

  /**
   * Creates a new chat task record in the database with an initial "queued" state.
   *
   * This is the first step of the async chat pipeline. It persists the incoming
   * query so that `processChatTask` can run fire-and-forget while the client
   * polls `getTaskStatus` using the returned task ID.
   *
   * @param query - The user's raw question string.
   * @param userId - Optional. The authenticated user's ID. If provided, the task
   *   is associated with the user for ownership checks and conversation linking.
   * @param conversationId - Optional. Links the task to an existing conversation
   *   thread. Populated by `startChatTask` before this is called.
   * @returns The MongoDB ObjectId string of the newly created chat document.
   * @throws {Error} If the database connection is not ready.
   */
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

  /**
   * The core background worker for a chat task. Runs the full RAG pipeline —
   * retrieval, context building, LLM generation — and writes each progress
   * step back to the database so the client can poll live status updates.
   *
   * This method is always called fire-and-forget via `void` in `startChatTask`.
   * It never throws externally; all errors are caught and written to the task
   * document as a "failed" status.
   *
   * Pipeline stages (reflected in the `progress` field of the chat document):
   *  1. `embedding_query`   — resolves bound document IDs for the conversation,
   *                           then embeds the query via `RagRetrievalService`.
   *  2. `retrieving_chunks` — queries Pinecone for top-K similar chunks.
   *                           Uses the `user-docs` namespace when bound documents
   *                           exist, otherwise falls back to `corpus` namespace.
   *  3. `building_context`  — formats retrieved chunks into a context string
   *                           for the LLM prompt.
   *  4. `generating_answer` — calls the LLM with the system prompt + context.
   *  5. `done`              — writes the final answer, sources, and retrieval
   *                           metadata to the task document as "completed".
   *                           Also updates the conversation's `updatedAt`
   *                           timestamp via `touchConversation`.
   *  6. `error`             — written on any uncaught exception; sets status
   *                           to "failed" with the error message.
   *
   * @param taskId - The MongoDB ObjectId string of the chat document to update.
   * @param query - The original user question string.
   * @param userId - Optional. Used to resolve bound documents and touch the
   *   conversation. Safe to omit for anonymous chats.
   * @param conversationId - Optional. Required alongside `userId` to look up
   *   bound documents and update the conversation timestamp.
   *
   * @remarks
   * **Known issue — progress update order:** Steps 1 and 2 progress labels are
   * written to the DB before the actual work begins. The client will see
   * "Retrieving relevant chunks..." while embedding is still running.
   *
   * **Known issue — corpus fallback namespace:** When bound documents exist but
   * return 0 useful chunks, the fallback corpus query incorrectly reuses the
   * `user-docs` namespace instead of `corpus`. Fix is in `RagRetrievalService`.
   */
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
          retrievalMeta: payload.retrievalMeta ?? { topK: 0, usedChunks: 0, retrievalMode: 'corpus-only'},
        };
      }

      await this.updateTask(taskId, updateData);
    }

    try {
      await update("embedding_query", "Embedding user query...");

      let boundDocumentIds: string[] = [];
      if (ENABLE_FILE_AWARE_CHAT && userId && conversationId) {
        boundDocumentIds = await this.attachmentContextService.resolveBoundDocumentIds(userId, conversationId);
      }
      
      await update("retrieving_chunks", "Retrieving relevant chunks...");

      const retrieval = await this.ragRetrievalService.retrieveContext({
        query,
        topK: 5,
        minScore: 0.0,
        boundDocumentIds,
        namespace: boundDocumentIds.length > 0 ? GLOBAL_CONFIG.pineconeUserDocsNamespace : GLOBAL_CONFIG.pineconeCorpusNamespace,
        globalNamespace: GLOBAL_CONFIG.pineconeUserDocsNamespace,
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
          // 잠깐 'corpus-only'로 지정함. 기능 추가해서 바꿀 것. 
          retrievalMode: retrieval.retrievalMode,
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

  /**
   * Entry point for the async chat pipeline. 
   * Flow:
   *  1. If `conversationId` is given → verify the user owns it.
   *  2. If no `conversationId` → auto-create a new conversation titled with the first 50 chars of the query.
   *  3. Call `createTask` to insert the chat document in "queued" state.
   *  4. Fire `processChatTask` (fire-and-forget via `void`).
   *  5. Return `taskId` immediately so the client can begin polling.
   *
   * @param query - The user's question string.
   * @param userId - Optional. The authenticated user's ID. When omitted the chat
   *   runs anonymously — no conversation is created or linked.
   * @param conversationId - Optional. The target conversation to attach this chat to. If omitted and `userId` is present, a new conversation is auto-created.
   * @returns An object containing:
   *   - `taskId` — poll `GET /chat/status/:taskId` to track progress.
   *   - `message` — a static confirmation string ("Started").
   *   - `conversationId` — the resolved or newly created conversation ID,
   *     `undefined` for anonymous chats.
   * @throws {Error} If `conversationId` is provided but the user does not own it
   *   (propagated from `ensureOwnership`).
   */
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
