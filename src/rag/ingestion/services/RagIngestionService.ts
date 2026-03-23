import { INGESTION_STATUS } from "../../shared/constants/IngestionStatus";
import { RagDocumentRepository } from "../repositories/RagDocumentRepository";
import { IngestDocumentInput, IngestDocumentResult} from "../types/rag.types";
import { ContentHashService } from "./ContentHashService";
import { EmbeddingService } from "./EmbeddingService";
import { PdfExtractionService } from "./PdfExtractionService";
import { PineconeIndexService } from "./PineconeIndexService";
import { TextChunkingService } from "./TextChunkingService";
import { TextNormalizationService } from "./TextNormalizationService";
import { VisionService } from "src/services/VisionService";
import { logger } from "src/utils/log";

export class RagIngestionService {
    constructor(
        private readonly ragDocumentRepository = new RagDocumentRepository(),
        private readonly pdfExtractionService = new PdfExtractionService(),
        private readonly visionService = new VisionService(),
        private readonly textNormalizationService = new TextNormalizationService(),
        private readonly contentHashService = new ContentHashService(),
        private readonly textChunkingService = new TextChunkingService(),
        private readonly embeddingService = new EmbeddingService(),
        private readonly pineconeIndexService = new PineconeIndexService()
    ) {}

    async ingestDocument(command: IngestDocumentInput): Promise<IngestDocumentResult> {
        try {
            logger.i(`Starting document ingestion for file: ${command.originalFileName}`);

            // 1. Extract
            logger.i("Step 1: Extracting text from Document...");
            let rawText: string;
            if(command.mimeType === 'application/pdf') {
                rawText = await this.pdfExtractionService.extractTextFromBuffer(command.fileBuffer);
            } else if (['image/jpeg', 'image/png', 'image/webp'].includes(command.mimeType)) {
                const base64 = command.fileBuffer.toString('base64');
                rawText = await this.visionService.extractTextFromImage(base64, command.mimeType);
            } else {
                throw new Error(`Unsupported file type: ${command.mimeType}`);
            }

            logger.i(`Extracted ${rawText.length} characters from Document`);

            // 2. Normalize
            logger.i("Step 2: Normalizing text...");
            const normalizedText = this.textNormalizationService.normalize(rawText);
            if (this.textNormalizationService.isEffectivelyEmpty(normalizedText)) {
                throw new Error("Extracted text is empty after normalization!");
            }

            if (normalizedText.length < 50) {
                throw new Error("Image contrains insufficient text for ingestion. (minimum 50 characters required)");
            }

            logger.i(`Normalized text: ${normalizedText.length} characters`);

            // 3. Hash
            logger.i("Step 3: Computing content hash...");
            const contentHash = this.contentHashService.createHash(normalizedText);
            logger.i(`Content hash: ${contentHash}`);

            // 4. Dedup check in Mongo
            logger.i("Step 4: Checking for duplicates...");
            const existing = await this.ragDocumentRepository.findByContentHash(contentHash);
            if (existing && existing.status !== INGESTION_STATUS.PENDING) {
                logger.i(`Document already exists (status: ${existing.status}). Skipping ingestion.`);
                return {
                    documentId: existing._id.toString(),
                    status: existing.status,
                    message: `Document already exists in system (status: ${existing.status})`,
                    isDuplicate: true,
                    chunkCount: existing.chunkCount,
                };
            }

            // 5. Save source-of-truth document first
            logger.i("Step 5: Creating pending document record...");
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
            logger.i(`Created pending document: ${documentId}`);

            try {
                // 6. Mark Processing
                logger.i("Step 6: Marking document as PROCESSING...");
                await this.ragDocumentRepository.markProcessing(documentId);

                // 7. Chunk
                logger.i("Step 7: Chunking document...");
                const chunks = await this.textChunkingService.chunkDocument({
                    documentId,
                    contentHash,
                    normalizedText,
                });
                logger.i(`Created ${chunks.length} chunks`);

                // 8. Embed
                logger.i("Step 8: Embedding chunks...");
                const embeddedChunks = await this.embeddingService.embedChunks(chunks);
                logger.i(`Embedded ${embeddedChunks.length} chunks`);

                // 9. Upload vectors
                logger.i("Step 9: Upserting vectors to Pinecone...");
                const vectorNamespace = this.pineconeIndexService.getNamespace(command.namespace);
                await this.pineconeIndexService.upsertDocumentVectors({
                    documentId,
                    contentHash,
                    originalFileName: command.originalFileName,
                    namespace: vectorNamespace,
                    vectors: embeddedChunks,
                });
                logger.i(`Vectors upserted to namespace: ${vectorNamespace}`);

                // 10. Mark processed
                logger.i("Step 10: Marking document as PROCESSED...");
                await this.ragDocumentRepository.markProcessed(documentId, {
                    chunkCount: chunks.length,
                    embeddingModel: this.embeddingService.getModelName(),
                    vectorNamespace,
                    processedAt: new Date(),
                });

                logger.i(`Document ingestion completed successfully for: ${command.originalFileName}`);

                return {
                    documentId,
                    status: INGESTION_STATUS.PROCESSED,
                    message: "Document Ingested Successfully",
                    isDuplicate: false,
                    chunkCount: chunks.length,
                };
            } catch (error) {
                logger.e(`Processing failed for document ${documentId}`, error);
                const errorMessage = error instanceof Error ? error.message : "Unknown Ingestion Error";
                await this.ragDocumentRepository.markFailed(documentId, errorMessage);
                throw error;
            }
        } catch (error) {
            logger.e(`Document ingestion failed for file: ${command.originalFileName}`, error);
            throw new Error(
                `Document ingestion failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}