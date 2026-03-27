import { Document, Schema, model } from "mongoose";

export interface IConversation extends Document {
    userId: string;
    title: string;
    pinned: boolean;
    lastMessageAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
    {
        userId: { type: String, required: true, index: true},
        title: { type: String, required: true, default: "New Chat"},
        pinned: { type: Boolean, required: true, default: false},
        lastMessageAt: { type: Date, required: true, default: () => new Date(), index: true },
    },
    {
        timestamps: true,
        collection: "conversations",
    }
);

ConversationSchema.index({ userId: 1, pinned: -1, lastMessageAt: -1 });

export const ConversationModel = model<IConversation>("Conversation", ConversationSchema);