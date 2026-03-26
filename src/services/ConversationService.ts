import mongoose from "mongoose";
import ChatModel from "src/models/Chat";
import { ConversationModel } from "src/models/Conversation";
import { ChatAttachmentBindingModel } from "src/models/ChatAttachmentBinding";
import { PineconeIndexService } from "src/rag/ingestion/services/PineconeIndexService";
import { GLOBAL_CONFIG } from "src/settings";

export interface ConversationListItem {
  id: string;
  title: string;
  pinned: boolean;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessageItem {
  id: string;
  query: string;
  answer?: string;
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: Date;
}

export class ConversationService {
  private static instance: ConversationService;
  private readonly DEFAULT_TITLE = "New Chat";
  private readonly pineconeIndexService = new PineconeIndexService();

  private constructor() {}

  public static getInstance(): ConversationService {
    if (!ConversationService.instance) {
      ConversationService.instance = new ConversationService();
    }
    return ConversationService.instance;
  }

  public async createConversation(
    userId: string,
    title?: string
  ): Promise<{ conversationId: string }> {
    this.ensureDbReady();

    const conversation = await ConversationModel.create({
      userId,
      title: this.normalizeTitle(title),
      lastMessageAt: new Date(),
    });

    return { conversationId: conversation._id.toString() };
  }

  public async listConversations(userId: string): Promise<ConversationListItem[]> {
    this.ensureDbReady();

    const rows = await ConversationModel.find({ userId }).sort({ pinned: -1, lastMessageAt: -1 });
    return rows.map((row) => this.toListItem(row));
  }

  public async togglePin(userId: string, conversationId: string, pinned: boolean){
    this.ensureDbReady();

    const updated = await ConversationModel.findOneAndUpdate(
      { _id: conversationId, userId },
      { pinned },
    );
    if (!updated) throw new Error("Conversation not found");
  }

  public async searchConversations(
    userId: string,
    keyword: string
  ): Promise<ConversationListItem[]> {
    this.ensureDbReady();

    const queryWord = keyword.trim();
    if (!queryWord) {
      return this.listConversations(userId);
    }

    const rows = await ConversationModel.find({
      userId,
      title: { $regex: queryWord, $options: "i" },
    }).sort({ pinned: -1, lastMessageAt: -1 });

    return rows.map((row) => this.toListItem(row));
  }

  public async renameConversation(
    userId: string,
    conversationId: string,
    newTitle: string
  ): Promise<void> {
    this.ensureDbReady();

    const updated = await ConversationModel.findOneAndUpdate(
      { _id: conversationId, userId },
      { title: this.normalizeTitle(newTitle) },
      { new: true }
    );

    if (!updated) {
      throw new Error("Conversation not found");
    }
  }

  public async deleteConversation(userId: string, conversationId: string): Promise<void> {
    this.ensureDbReady();

    const conversation = await ConversationModel.findOne({ _id: conversationId, userId });
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const bindings = await ChatAttachmentBindingModel.find({ userId, conversationId }).select("documentId");
    const documentIds = bindings.map((b) => b.documentId);

    await Promise.all(
      documentIds.map((documentId) =>
        this.pineconeIndexService.deleteByDocumentId(documentId, GLOBAL_CONFIG.pineconeUserDocsNamespace)
      )
    );

    await ChatAttachmentBindingModel.deleteMany({ userId, conversationId });
    await ChatModel.deleteMany({ userId, conversationId });
    await ConversationModel.deleteOne({ _id: conversationId, userId });
  }

  public async touchConversation(userId: string, conversationId: string): Promise<void> {
    this.ensureDbReady();

    await ConversationModel.findOneAndUpdate(
      { _id: conversationId, userId },
      { lastMessageAt: new Date() }
    );
  }

  public async ensureOwnership(userId: string, conversationId: string): Promise<void> {
    this.ensureDbReady();

    const exists = await ConversationModel.exists({ _id: conversationId, userId });
    if (!exists) {
      throw new Error("Conversation not found");
    }
  }

  public async trySetAutoTitle(
    userId: string,
    conversationId: string,
    candidateTitle: string
  ): Promise<boolean> {
    this.ensureDbReady();

    const finalTitle = this.sanitizeAutoTitle(candidateTitle);
    if (finalTitle === this.DEFAULT_TITLE) {
      return false;
    }

    const updated = await ConversationModel.findOneAndUpdate(
      { _id: conversationId, userId, title: this.DEFAULT_TITLE },
      { title: finalTitle },
      { new: true }
    );

    return Boolean(updated);
  }

  public async getConversationMessages(
    userId: string,
    conversationId: string
  ): Promise<ConversationMessageItem[]> {
    this.ensureDbReady();

    await this.ensureOwnership(userId, conversationId);

    const rows = await ChatModel.find({ userId, conversationId })
      .sort({ createdAt: 1 })
      .select({
        _id: 1,
        query: 1,
        answer: 1,
        status: 1,
        createdAt: 1,
      });

    return rows.map((row) => ({
      id: row._id.toString(),
      query: row.query,
      answer: row.answer,
      status: row.status,
      createdAt: row.createdAt,
    }));
  }

  private normalizeTitle(title?: string): string {
    const clean = (title ?? "").trim();
    if (!clean) return this.DEFAULT_TITLE;
    if (clean.length > 120) {
      throw new Error("Title must be 120 characters or fewer");
    }
    return clean;
  }

  private sanitizeAutoTitle(raw: string): string {
    const cleaned = raw
      .replace(/[\r\n]+/g, " ")
      .replace(/^["'`]+|["'`]+$/g, "")
      .trim();

    if (!cleaned) return this.DEFAULT_TITLE;
    return cleaned.slice(0, 60);
  }

  private toListItem(row: any): ConversationListItem {
    return {
      id: row._id.toString(),
      title: row.title,
      pinned: row.pinned ?? false,
      lastMessageAt: row.lastMessageAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private ensureDbReady(): void {
    if (mongoose.connection.readyState !== 1) {
      throw new Error("Database connection is not ready");
    }
  }
}