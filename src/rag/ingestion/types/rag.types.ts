/* 
    Shared Contracts between controllers, service and repository. 
    Confirm that each layer uses the same field
*/

import { IngestionStatus } from "../../shared/constants/IngestionStatus";

// Standard shape after chunking service
export interface ChunkPayload {
    chunkId: string;
    chunkIndex: number;
    text: string;
}

// Standard shape before Pinecone Upsert
export interface EmbeddingPayload {
    chunkId: string;
    chunkIndex: number;
    values: number[];
    text: string;
}

// Tracks who uploaded the document
export interface IngestionActor {
    userId: string;
    role: "user" | "admin";
} 

export interface IngestDocumentInput {
    fileBuffer: Buffer;
    originalFileName: string;
    mimeType: string;
    fileSize: number;
    actor: IngestionActor;
    namespace?: string;
}

export interface IngestDocumentResult {
    documentId: string;
    status: IngestionStatus;
    message: string;
    isDuplicate: boolean;
    chunkCount: number;
}

// Exact fields repository needs to create Mongo record
export interface RagDocumentCreateInput {
    originalFileName: string;
    mimeType: string;
    fileSize: number;
    normalizedText: string;
    contentHash: string;
    status: IngestionStatus;
    ingestedBy: string;
}

export interface RagDocumentProcessStats {
    chunkCount: number;
    embeddingModel: string;
    vectorNamespace: string;
    processedAt: Date;
}
