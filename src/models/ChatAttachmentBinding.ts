import { Document, Schema, model } from "mongoose";

export interface IChatAttachmentBinding extends Document {
    userId: string;
    conversationId: string;
    documentId: string;
    createdAt: Date;
    updatedAt: Date;
} 

const ChatAttachmentBindingSchema = new Schema<IChatAttachmentBinding>(
    {
        userId: { type: String, required: true },
        conversationId: { type: String, required: true },
        documentId: { type: String, required: true },
    },
    {
        timestamps: true,
        collection: "chat_attachment_bindings",
    }
);

// for fast lookup of all bindings in a conversation
ChatAttachmentBindingSchema.index(
    { userId: 1, conversationId: 1, documentId: 1},
    { unique: true }
);

export const ChatAttachmentBindingModel = model<IChatAttachmentBinding>(
    "ChatAttachmentBinding",
    ChatAttachmentBindingSchema
)