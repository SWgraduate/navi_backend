import e from "cors";
import mongoose from "mongoose";
import { ChatAttachmentBindingModel } from "src/models/ChatAttachmentBinding";
import { ConversationModel } from "src/models/Conversation";
import { RagDocumentModel } from "src/rag/ingestion/models/RagDocument";
import { logger } from "src/utils/log";

export class AttachmentContextService {
    private static instance: AttachmentContextService;

    private constructor() {}

    public static getInstance(): AttachmentContextService {
        if (!AttachmentContextService.instance){
            AttachmentContextService.instance = new AttachmentContextService();
        }
        return AttachmentContextService.instance;
    }

    public async ensureConversationOwnership(userId: string, conversationId: string): Promise<void> {
        const conversation = await ConversationModel.findOne({ _id: conversationId, userId});
        if (!conversation) {
            throw new Error("Conversation not found or access denied");
        }
    }

    public async bindDocument(userId: string, conversationId: string, documentId: string): Promise<void> {
        await this.ensureConversationOwnership(userId, conversationId);

        const doc = await RagDocumentModel.findById(documentId);
        if (!doc) throw new Error("Document not found");
        if (doc.status !== "processed") throw new Error("Document is not ready");

        try {
            await ChatAttachmentBindingModel.create({ userId, conversationId, documentId });
            logger.i(`Bound document ${documentId} to conversation ${conversationId}`);
        } catch (error: any) {
            // MongoDB duplicate key error -- 11000
            if (error.code === 11000) {
                logger.i(`Document ${documentId} already bound to conversation ${conversationId}, skipping`);
                return;
            }
            throw error; 
        }
    }

    public async listBoundDocuments(userId: string, conversationId: string) {
        await this.ensureConversationOwnership(userId, conversationId);
        return ChatAttachmentBindingModel.find({ userId, conversationId }).sort({ createdAt: -1 });
    }

    public async unbindDocument(userId: string, conversationId: string, documentId: string): Promise<void> {
        await this.ensureConversationOwnership(userId, conversationId);
        await ChatAttachmentBindingModel.deleteOne({ userId, conversationId, documentId});
        logger.i(`Unbound document ${documentId} from conversation ${conversationId}`);
    }

    public async resolveBoundDocumentIds(userId: string, conversationId: string ): Promise<string[]> {
        const bindings = await ChatAttachmentBindingModel.find({ userId, conversationId });
        return bindings.map(binding => binding.documentId);
    }

}