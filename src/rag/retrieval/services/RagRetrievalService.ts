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

            const rawChunks = await this.pineconeIndexService.queryTopK({
                vector: queryVector,
                topK,
                namespace: params.namespace,
            });

            const filtered = this.filterAndSortChunks(rawChunks, minScore);

            logger.i(`Retrieving context for query: "${params.query}"`);
            logger.i(`Retrieved ${filtered.length} chunks`);

            return {
                query: params.query,
                topK,
                usedChunks: filtered.length,
                chunks: filtered,
            };
        }
        catch (error) {
            throw new Error(
                `Failed to retrieve context: ${error instanceof Error ? error.message : String(error)}`
            );
        }

    }
}