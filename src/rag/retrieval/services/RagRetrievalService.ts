import { EmbeddingService } from "../../ingestion/services/EmbeddingService";
import { PineconeIndexService } from "../../ingestion/services/PineconeIndexService";
import { 
    RetrieveContextParams,
    RetrieveContextResult,
    RetrievedChunk,
} from "../types/retrieval.types";

// Given a user question, find relevant document chunks.
export class RagRetrievalService {
    constructor(
        private readonly embeddingService = new EmbeddingService(),
        private readonly pineconeIndexService = new PineconeIndexService()
    ) {}

    async retrieveContext(params: RetrieveContextParams): Promise<RetrieveContextResult> {
        const topK = params.topK ?? 5;
        const minScore = params.minScore ?? 0.0;

        const queryVector = await this.embeddingService.embedQuery(params.query);

        const matches = await this.pineconeIndexService.queryTopK({
            vector: queryVector,
            topK,
            namespace: params.namespace,
        });
        
        const filtered: RetrievedChunk[] = matches.filter((chunk) => chunk.documentId && chunk.score >= minScore).sort((a, b) => b.score - a.score);

        return {
            query: params.query,
            topK,
            usedChunks: filtered.length,
            chunks: filtered,
        }
    }
}