import ChatModel, { IChat, IChatResult, IChatSource } from "src/models/Chat";
import { ConversationService } from "./ConversationService";
import mongoose from "mongoose";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { GLOBAL_CONFIG, OPENROUTER_API_KEY } from 'src/settings';
import { RagRetrievalService } from "src/rag/retrieval/services/RagRetrievalService";
import { EmbeddingService } from "src/rag/ingestion/services/EmbeddingService";
import { PineconeIndexService } from "src/rag/ingestion/services/PineconeIndexService";
import { RetrievedChunk } from "src/rag/retrieval/types/retrieval.types";
import { ERICA_SYSTEM_PROMPT } from "src/rag/shared/prompts/ericaSystemPrompt";
import { AttachmentContextService } from "./AttachmentContextService";
import { logger } from "src/utils/log";

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

  private constructor() { }

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
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
    conversationId?: string,
    hasAttachments?: boolean,
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
    logger.i(`[Chat:${taskId.slice(-6)}] Task queued | taskId=${taskId} conversationId=${resolvedConversationId ?? 'none'}`);
    void this.processChatTask(taskId, query, userId, resolvedConversationId, hasAttachments);

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
   */
  private async processChatTask(taskId: string, query: string, userId?: string, conversationId?: string, hasAttachments?: boolean) {
    const tag = `[Chat:${taskId.slice(-6)}]`;

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

      if (payload?.answer !== undefined) {
        updateData.answer = payload.answer;
      }

      if (payload?.sources || payload?.retrievalMeta) {
        updateData.result = {
          answer: payload.answer ?? "",
          sources: payload.sources ?? [],
          retrievalMeta: payload.retrievalMeta ?? { topK: 0, usedChunks: 0, retrievalMode: 'corpus-only' },
        };
      }

      await this.updateTask(taskId, updateData);
    }

    try {
      logger.i(`${tag} Pipeline started | query="${query.slice(0, 80)}${query.length > 80 ? '...' : ''}" userId=${userId ?? 'anon'} conversationId=${conversationId ?? 'none'}`);

      // Step 1: Resolve bound documents
      await update("embedding_query", "Embedding user query...");
      logger.i(`${tag} [1/5] Resolving bound documents... hasAttachments=${hasAttachments ?? false}`);
      const boundDocumentIds = await this.resolveBoundDocuments(userId, conversationId, hasAttachments);
      logger.i(`${tag} [1/5] Bound documents resolved: [${boundDocumentIds.join(', ') || 'none'}]`);

      // Step 2: Retrieve chunks
      const namespace = boundDocumentIds.length > 0 ? GLOBAL_CONFIG.pineconeUserDocsNamespace : GLOBAL_CONFIG.pineconeCorpusNamespace;
      await update("retrieving_chunks", "Retrieving relevant chunks...");
      logger.i(`${tag} [2/5] Querying Pinecone | namespace="${namespace}" topK=5`);
      const retrieval = await this.ragRetrievalService.retrieveContext({
        query,
        topK: 5,
        boundDocumentIds,
        namespace,
        globalNamespace: GLOBAL_CONFIG.pineconeCorpusNamespace,
      });
      logger.i(`${tag} [2/5] Retrieval done | mode=${retrieval.retrievalMode} usedChunks=${retrieval.usedChunks}/${retrieval.topK}`);
      retrieval.chunks.forEach((c, i) =>
        logger.d(`${tag}   chunk[${i}] score=${c.score.toFixed(4)} file="${c.fileName ?? 'unknown'}" chunkId=${c.chunkId}`)
      );

      // Step 3: Build context
      await update("building_context", "Building context for answer...");
      logger.i(`${tag} [3/5] Building context from ${retrieval.chunks.length} chunks`);
      const contextText = this.buildContextText(retrieval.chunks, 5);
      logger.d(`${tag} [3/5] Context length: ${contextText.length} chars`);

      // Step 4: Call LLM
      await update("generating_answer", "Generating grounded answer...");
      logger.i(`${tag} [4/5] Calling LLM | model=${GLOBAL_CONFIG.chatModel}`);
      const history = conversationId ? await this.getRecentHistory(conversationId, 5) : [];
      logger.i(`${tag} [4/5] History turns loaded: ${history.length}`);
      const answer = await this.callGroundedLLM(query, contextText, history);
      logger.s(`${tag} [4/5] LLM responded | answer length=${answer.length} chars`);

      // Step 5: Save result
      logger.i(`${tag} [5/5] Saving result to DB...`);
      await update("done", "Completed", {
        answer,
        sources: this.buildSources(retrieval.chunks),
        retrievalMeta: {
          topK: retrieval.topK,
          usedChunks: retrieval.usedChunks,
          retrievalMode: retrieval.retrievalMode,
        },
      });
      logger.s(`${tag} Pipeline completed successfully`);

      if (userId && conversationId) {
        await this.conversationService.touchConversation(userId, conversationId);
        logger.d(`${tag} Conversation timestamp updated`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.e(`${tag} Pipeline failed:`, message);
      await this.updateTask(taskId, {
        status: "failed",
        progress: "error",
        displayMessage: "An error occurred.",
        error: message,
      });
    }
  }

  private async resolveBoundDocuments(userId?: string, conversationId?: string, hasAttachments?: boolean): Promise<string[]> {
    if (!GLOBAL_CONFIG.enableFileAwareChat || !userId || !conversationId || !hasAttachments) return [];
    return this.attachmentContextService.resolveBoundDocumentIds(userId, conversationId);
  }

  private buildSources(chunks: RetrievedChunk[]): IChatSource[] {
    return chunks.slice(0, 5).map((chunk) => ({
      documentId: chunk.documentId,
      fileName: chunk.fileName,
      chunkId: chunk.chunkId,
      chunkIndex: chunk.chunkIndex,
      score: chunk.score,
    }));
  }

  private buildContextText(chunks: RetrievedChunk[], maxChunks = 5): string {
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

  private async getRecentHistory(conversationId: string, limit: number): Promise<{ query: string; answer: string }[]> {
    const rows = await ChatModel.find({ conversationId, status: "completed", answer: { $exists: true, $ne: "" } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select({ query: 1, answer: 1 });

    return rows.reverse().map(r => ({ query: r.query, answer: r.answer! }));
  }

  private async callGroundedLLM(query: string, contextText: string, history: { query: string; answer: string }[] = []): Promise<string> {
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

    const userPrompt = [
      `Question: ${query}`,
      "",
      "Context:",
      contextText || "(no relevant context found)",
    ].join("\n");

    const historyMessages = history.flatMap(turn => [
      new HumanMessage(turn.query),
      new AIMessage(turn.answer),
    ]);

    const response = await chat.invoke([
      new SystemMessage(ERICA_SYSTEM_PROMPT),
      ...historyMessages,
      new HumanMessage(userPrompt),
    ]);

    return typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);
  }

  /**
   * 음성 파이프라인 전용: RAG 검색 후 LLM 답변 텍스트를 즉시 반환합니다.
   * DB Task를 생성하거나 상태를 업데이트하지 않으며, 오직 답변 문자열만 반환합니다.
   * (VoiceSessionManager의 STT -> LLM -> TTS 파이프라인에서 사용)
   *
   * @param query - 사용자의 음성 입력이 STT로 변환된 질문 텍스트
   * @returns LLM이 생성한 답변 텍스트 문자열
   */
  public async generateDirectAnswer(query: string): Promise<string> {
    const retrieval = await this.ragRetrievalService.retrieveContext({
      query,
      topK: 5,
      boundDocumentIds: [],
      namespace: GLOBAL_CONFIG.pineconeCorpusNamespace,
      globalNamespace: GLOBAL_CONFIG.pineconeCorpusNamespace,
    });

    const contextText = this.buildContextText(retrieval.chunks, 5);
    return this.callGroundedLLM(query, contextText);
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

  private async updateTask(taskId: string, data: TaskUpdateData): Promise<void> {
    this.ensureDbReady();
    await ChatModel.findByIdAndUpdate(taskId, data);
  }

  private async getTask(taskId: string): Promise<IChat | null> {
    this.ensureDbReady();
    return ChatModel.findById(taskId);
  }

  private ensureDbReady(): void {
    if (mongoose.connection.readyState !== 1) {
      throw new Error("Database connection is not ready");
    }
  }
}
