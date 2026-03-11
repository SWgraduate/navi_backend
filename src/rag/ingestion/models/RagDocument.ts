/**
 * MongoDB RAG source-of-truth schema for ingestion lifecycle
 */

import { Document, Schema, model } from "mongoose";
import { INGESTION_STATUS, IngestionStatus } from "../../shared/constants/IngestionStatus";

export interface IRagDocument extends Document {
    originalFileName: string;
    mimeType: string;
    fileSize: number;
    normalizedText: string;
    contentHash: string;
    status: IngestionStatus;
    chunkCount: number;
    embeddingModel?: string;
    vectorNamespace?: string;
    ingestedBy: string;
    lastError?: string;
    processedAt?: Date;
    failedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const RagDocumentSchema = new Schema<IRagDocument>(
    {
       originalFileName: { type: String, required: true },
       mimeType: { type: String, required: true },
       fileSize: { type: Number, required: true },
       normalizedText: { type: String, required: true },
       contentHash: { type: String, required: true, unique: true },

       status: {
        type: String,
        enum: Object.values(INGESTION_STATUS),
        required: true,
        default: INGESTION_STATUS.PENDING,
        index: true,
       },

       chunkCount: { type: Number, required: true, default: 0},
       embeddingModel: { type: String },
       vectorNamespace: { type: String },
       ingestedBy: { type: String, required: true },

       lastError: { type: String },
       processedAt: { type: Date },
       failedAt: { type: Date },
    },
    { 
        timestamps: true,
        collection: "rag_documents"
    }

);

RagDocumentSchema.index({ createdAt: -1 });

export const RagDocumentModel = model<IRagDocument>(
    "RagDocument",
    RagDocumentSchema
);

