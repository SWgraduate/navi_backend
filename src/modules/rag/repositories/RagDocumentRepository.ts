import { Types } from "mongoose";
import { INGESTION_STATUS } from "../constants/IngestionStatus";
import { RagDocumentModel, IRagDocument } from "../models/RagDocument";
import { 
    RagDocumentCreateInput,
    RagDocumentProcessStats,
} from "../types/rag.types";

export class RagDocumentRepository {
    // Deduplication check
    async findByContentHash(contentHash: string): Promise<IRagDocument | null>{
        return RagDocumentModel.findOne({ contentHash }).exec();
    }

    // fetch document for retry/read flows
    async findById(documentId: string): Promise<IRagDocument | null>{
        if (!Types.ObjectId.isValid(documentId)) {
            return null;
        }
        return RagDocumentModel.findById(documentId).exec();
    } 

    // create source-of-truth record 
    async createPending(input: RagDocumentCreateInput): Promise<IRagDocument> {
        return RagDocumentModel.create({
            originalFileName: input.originalFileName,
            mimeType: input.mimeType,
            fileSize: input.fileSize,
            normalizedText: input.normalizedText,
            contentHash: input.contentHash,
            status: INGESTION_STATUS.PENDING,
            chunkCount: 0,
            ingestedBy: input.ingestedBy,
        });
    }

    // Mark "PROCESSING" -- as soon as chunk/embed starts
    async markProcessing(documentId: string): Promise<IRagDocument | null> {
        return RagDocumentModel.findByIdAndUpdate(
            documentId,
            {
                $set: {
                    status: INGESTION_STATUS.PROCESSING,
                    lastError: null,
                    failedAt: null,
                },
            },
            { new: true }
        ).exec();
    }

    // mark successful embedding
    async markProcessed(documentId: string, stats: RagDocumentProcessStats):
    Promise<IRagDocument | null> { 
        return RagDocumentModel.findByIdAndUpdate(
            documentId,
            {
                $set: {
                    status: INGESTION_STATUS.PROCESSED,
                    chunkCount: stats.chunkCount,
                    embeddingModel: stats.embeddingModel,
                    vectorNamespace: stats.vectorNamespace,
                    processedAt: stats.processedAt,
                    lastError: null,
                    failedAt: null,
                },
            },
            { new: true }
        ).exec();
    }

    // Mark failed if embed fails after Mongo save
    async markFailed(documentId: string, errorMessage: string):
    Promise<IRagDocument | null> {
        return RagDocumentModel.findByIdAndUpdate(
            documentId,
            {
                $set: {
                    status: INGESTION_STATUS.FAILED,
                    lastError: errorMessage,
                    failedAt: new Date(),
                },
            },

            { new: true }
        ).exec();
    }

}
