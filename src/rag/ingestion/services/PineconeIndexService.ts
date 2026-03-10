import { Pinecone, PineconeRecord } from "@pinecone-database/pinecone";
import { GLOBAL_CONFIG, PINECONE_API_KEY } from "src/settings";
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

        if (!apiKey)
            throw new Error("Missing PINECONE_API_KEY");
        if (!indexName)
            throw new Error("Missing PINECONE_INDEX_NAME");

        this.pinecone = new Pinecone({ apiKey });
        this.indexName = indexName;
        this.defaultNamespace = GLOBAL_CONFIG.pineconeNamespace;
    }

    getNamespace(namespace?: string): string {
        return namespace ?? this.defaultNamespace;
    }

    async upsertDocumentVectors(params: UpsertDocumentVectorsParams): Promise<void> {
        if (params.vectors.length === 0)
            return;

        const namespace = this.getNamespace(params.namespace);
        const index = this.pinecone.Index(this.indexName).namespace(namespace);

        const records: PineconeRecord<Record<string, string | number | boolean>>[] = params.vectors.map((vector) => ({
            id: vector.chunkId,
            values: vector.values,
            metadata: {
                documentId: params.documentId,
                chunkId: vector.chunkId,
                chunkIndex: vector.chunkIndex,
                contentHash: params.contentHash,
                fileName: params.originalFileName,
            },
        }));

        await index.upsert(records);
    }

    async queryTopK(params: QueryTopKParams): Promise<RetrievedChunk[]> {
        const namespace = this.getNamespace(params.namespace);
        const index = this.pinecone.Index(this.indexName).namespace(namespace);

        const result = await index.query({
            vector: params.vector,
            topK: params.topK,
            includeMetadata: true,
            includeValues: false,
        });

        return (result.matches ?? []).map((match) => {
            const metadata = (match.metadata ?? {}) as Record<string, unknown>;

            return {
                chunkId: String(metadata.chunkId ?? match.id ?? ""),
                documentId: String(metadata.documentId ?? ""),
                chunkIndex: Number(metadata.chunkIndex ?? 0),
                score: Number(match.score ?? 0),
                fileName: metadata.fileName ? String(metadata.fileName) : undefined,
                contentHash: metadata.contentHash ? String(metadata.contentHash) : undefined,
            };
        });
    }

    async deleteByDocumentId(documentId: string, namespace?: string): Promise<void> {
        const resolvedNamespace = this.getNamespace(namespace);
        const index = this.pinecone.Index(this.indexName).namespace(resolvedNamespace);


        await index.deleteMany({
            filter: {
                documentId: { $eq: documentId },
            },
        });
    }
}