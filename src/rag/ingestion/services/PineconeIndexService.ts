import { Pinecone, PineconeRecord } from "@pinecone-database/pinecone";
import { GLOBAL_CONFIG, PINECONE_API_KEY } from "src/settings";
import { logger } from "src/utils/log";
import { EmbeddingPayload } from "../types/rag.types";
import { RetrievedChunk } from "../../retrieval/types/retrieval.types";

interface UpsertDocumentVectorsParams {
    documentId: string;
    contentHash: string;
    originalFileName: string;
    namespace?: string;
    vectors: EmbeddingPayload[];
}

interface QueryTopKParams {
    vector: number[];
    topK: number;
    namespace?: string;
}

export class PineconeIndexService {
    private readonly pinecone: Pinecone;
    private readonly indexName: string;
    private readonly defaultNamespace: string;

    constructor() {
        const apiKey = PINECONE_API_KEY;
        const indexName = GLOBAL_CONFIG.pineconeIndexName;

        if (!apiKey) throw new Error("Missing PINECONE_API_KEY");
        if (!indexName) throw new Error("Missing PINECONE_INDEX_NAME");

        this.pinecone = new Pinecone({ apiKey });
        this.indexName = indexName;
        this.defaultNamespace = GLOBAL_CONFIG.pineconeNamespace;
    }

    public getNamespace(namespace?: string): string {
        return namespace ?? this.defaultNamespace;
    }

    async upsertDocumentVectors(params: UpsertDocumentVectorsParams): Promise<void> {
        try {
            if (params.vectors.length === 0) return;

            if (!params.documentId?.trim()) {
                throw new Error("documentId cannot be empty");
            }
            if (!params.originalFileName?.trim()) {
                throw new Error("originalFileName cannot be empty");
            }

            const namespace = this.getNamespace(params.namespace);
            const index = this.pinecone.Index(this.indexName).namespace(namespace);

            logger.i(`Upserting ${params.vectors.length} vectors for document: ${params.documentId}`);

            const records: PineconeRecord<Record<string, string | number | boolean>>[] = params.vectors.map((vector) => ({
                id: vector.chunkId,
                values: vector.values,
                metadata: {
                    documentId: params.documentId,
                    chunkId: vector.chunkId,
                    chunkIndex: vector.chunkIndex,
                    contentHash: params.contentHash,
                    fileName: params.originalFileName,
                    text: vector.text,
                },
            }));

            await index.upsert(records);

            logger.i(`Successfully upserted ${params.vectors.length} vectors for document: ${params.documentId}`);
        } catch (error) {
            logger.e(`Failed to upsert document vectors for ${params.documentId}`, error);
            throw new Error(
                `Failed to upsert document vectors: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    async queryTopK(params: QueryTopKParams): Promise<RetrievedChunk[]> {
        try {
            if (!params.vector || params.vector.length === 0) {
                throw new Error("Query vector cannot be empty");
            }
            if (params.topK <= 0) {
                throw new Error("topK must be greater than 0");
            }

            const namespace = this.getNamespace(params.namespace);
            const index = this.pinecone.Index(this.indexName).namespace(namespace);

            logger.i(`Querying top ${params.topK} vectors from namespace: ${namespace}`);

            const result = await index.query({
                vector: params.vector,
                topK: params.topK,
                includeMetadata: true,
                includeValues: false,
            });

            const retrievedChunks = (result.matches ?? []).map((match) => {
                const metadata = (match.metadata ?? {}) as Record<string, unknown>;

                return {
                    chunkId: String(metadata.chunkId ?? match.id ?? ""),
                    documentId: String(metadata.documentId ?? ""),
                    chunkIndex: Number(metadata.chunkIndex ?? 0),
                    score: Number(match.score ?? 0),
                    fileName: metadata.fileName ? String(metadata.fileName) : undefined,
                    contentHash: metadata.contentHash ? String(metadata.contentHash) : undefined,
                    text: metadata.text ? String(metadata.text) : undefined,
                };
            });

            logger.i(`Query returned ${retrievedChunks.length} results`);

            return retrievedChunks;
        } catch (error) {
            logger.e("Failed to query Pinecone index", error);
            throw new Error(
                `Failed to query vector database: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    async deleteByDocumentId(documentId: string, namespace?: string): Promise<void> {
        try {
            if (!documentId?.trim()) {
                throw new Error("documentId cannot be empty");
            }

            const resolvedNamespace = this.getNamespace(namespace);
            const index = this.pinecone.Index(this.indexName).namespace(resolvedNamespace);

            logger.i(`Deleting vectors for document: ${documentId} from namespace: ${resolvedNamespace}`);

            await index.deleteMany({
                filter: {
                    documentId: { $eq: documentId },
                },
            });

            logger.i(`Successfully deleted vectors for document: ${documentId}`);
        } catch (error) {
            logger.e(`Failed to delete vectors for document ${documentId}`, error);
            throw new Error(
                `Failed to delete document vectors: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}