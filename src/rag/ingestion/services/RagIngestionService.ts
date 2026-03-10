import { INGESTION_STATUS } from "../../shared/constants/IngestionStatus";
import { RagDocumentRepository } from "../repositories/RagDocumentRepository";
import { RagDocumentCreateInput } from "../types/rag.types";
import { IngestPdfCommand, IngestPdfResult } from "../types/rag.types";
import { ContentHashService } from "./ContentHashService";
import { EmbeddingService } from "./EmbeddingService";
import { PdfExtractionService } from "./PdfExtractionService";
import { PineconeIndexService } from "./PineconeIndexService";
import { TextChunkingService } from "./TextChunkingService";
import { TextNormalizationService } from "./TextNormalizationService";

export class RagIngestionService {
    constructor(
        private readonly ragDocumentRepository = new RagDocumentRepository(),
        private readonly pdfExtractionService = new PdfExtractionService(),
        private readonly textNormalizationService = new TextNormalizationService(),
        private readonly contentHashService = new ContentHashService(),
        private readonly textChunkingSerivice = new TextChunkingService(),
        private readonly embeddingService = new EmbeddingService(),
        private readonly pineconeIndexService = new PineconeIndexService()
    ) {}

    async ingestPdf(command: IngestPdfCommand): Promise<IngestPdfResult> {
        // 1. Extract
        const rawText = await this.pdfExtractionService.extractTextFromBuffer(
            command.fileBuffer
        );

        // 2. Normalize
        const normalizedText = this.textNormalizationService.normalize(rawText);
        if (this.textNormalizationService.isEffectivelyEmpty(normalizedText)) {
            throw new Error("Exracted text is empty after normalization!");
        }

        // 3. Hash
        const contentHash = this.contentHashService.createHash(normalizedText);

        // 4. Dedup check in Mongo
        const existing = await this.ragDocumentRepository.findByContentHash(contentHash);
        if (existing && existing.status === INGESTION_STATUS.PROCESSED){
            return {
                documentId: existing._id.toString(),
                status: existing.status,
                message: "Document already exists in Mongo. (duplicate content hash)",
                isDuplicate: true,
                chunkCount: existing.chunkCount,
            };
        }

        // 5. Save source-of-truth document first
        const created = await this.ragDocumentRepository.createPending({
            originalFileName: command.originalFileName,
            mimeType: command.mimeType,
            fileSize: command.fileSize,
            normalizedText,
            contentHash,
            status: INGESTION_STATUS.PENDING,
            ingestedBy: command.actor.userId,
        });

        const documentId = created._id.toString();

        try {
            // 6. Mark Processing
            await this.ragDocumentRepository.markProcessing(documentId);

            // 7. Chunk
            const chunks = await this.textChunkingSerivice.chunkDocument({
                documentId,
                contentHash,
                normalizedText,
            });

            // 8. Embed
            const embeddedChunks = await this.embeddingService.embedChunks(chunks);

            // 9. Upload vectors
            const vectorNamespace = this.pineconeIndexService.getNamespace();

            await this.pineconeIndexService.upsertDocumentVectors({
                documentId,
                contentHash,
                originalFileName: command.originalFileName,
                namespace: vectorNamespace,
                vectors: embeddedChunks,
            });

            // 10. Mark processed
            await this.ragDocumentRepository.markProcessed(documentId, {
                chunkCount: chunks.length,
                embeddingModel: this.embeddingService.getModelName(),
                vectorNamespace,
                processedAt: new Date(),
            });

            return {
                documentId,
                status: INGESTION_STATUS.PROCESSED,
                message: "Document Ingested Successfully",
                isDuplicate: false,
                chunkCount: chunks.length,
            };
        } catch(error) {
            // If Pinecone (or embedding/chunking) fails after Mongo save
            const errorMessage = error instanceof Error ? error.message : "Unknown Ingestion Error";

            await this.ragDocumentRepository.markFailed(documentId, errorMessage);
            throw error;
        }

    }
}