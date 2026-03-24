import { logger } from "src/utils/log";
import { EmbeddingService } from "../../ingestion/services/EmbeddingService";
import { PineconeIndexService } from "../../ingestion/services/PineconeIndexService";
import { 
    RetrieveContextParams,
    RetrieveContextResult,
    RetrievedChunk,
} from "../types/retrieval.types";

const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SCORE = 0.0;
const MIN_BOUND_SCORE = 0.3;

// Given a user question, find relevant document chunks.
export class RagRetrievalService {
    constructor(
        private readonly embeddingService: EmbeddingService,
        private readonly pineconeIndexService: PineconeIndexService,
    ) {}

    private validateInputParams(params: RetrieveContextParams): void {
        if (!params.query?.trim()){
            throw new Error("Query cannot be empty!");
        }
        if (params.topK && params.topK <= 0) {
            throw new Error("topK must be greater than 0");
        }
    }

    private filterAndSortChunks(
        chunks: RetrievedChunk[],
        minScore: number
    ): RetrievedChunk[] {
        return chunks
            .filter((chunk) => chunk.documentId && chunk.score >= minScore)
            .sort((a, b) => b.score - a.score);
    }

    async retrieveContext(params: RetrieveContextParams): Promise<RetrieveContextResult> {
        try {
            this.validateInputParams(params);

            const topK = params.topK ?? DEFAULT_TOP_K;
            const minScore = params.minScore ?? DEFAULT_MIN_SCORE;

            const queryVector = await this.embeddingService.embedQuery(params.query);

            const hasBoundDocs = params.boundDocumentIds && params.boundDocumentIds.length > 0;

            if (hasBoundDocs) {
                // Attept 1: search only bound documents with higher score threshold
                const boundChunks = await this.pineconeIndexService.queryTopK({
                    vector: queryVector,
                    topK,
                    namespace: params.namespace,
                    filter: { documentId: { $in: params.boundDocumentIds } },
                });

                const filtered = this.filterAndSortChunks(boundChunks, MIN_BOUND_SCORE);

                if (filtered.length > 0) {
                    logger.i(`Bound retrieval: ${filtered.length} chunks above threshold`);
                    return {
                        query: params.query,
                        topK,
                        usedChunks: filtered.length,
                        chunks: filtered,
                        retrievalMode: 'bound',
                    };
                }

                logger.i(`Bound retrieval returned 0 useful chunks - falling back corpus`);
            }

            // Attempt 2 (or only attempt if no bound docs): global corpus search
            const corpusChunks = await this.pineconeIndexService.queryTopK({
                vector: queryVector,
                topK,
                namespace: params.globalNamespace ?? params.namespace,
            });

            const filtered = this.filterAndSortChunks(corpusChunks, DEFAULT_MIN_SCORE);

            logger.i(`Corpus retrieval: ${filtered.length} chunks`);

            return {
                query: params.query,
                topK,
                usedChunks: filtered.length,
                chunks: filtered,
                retrievalMode: hasBoundDocs ? 'corpus-fallback' : 'corpus-only',
            };

        } catch (error) {
            throw new Error(
                `Failed to retrieve context: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}