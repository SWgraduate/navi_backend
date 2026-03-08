import { Pinecone, PineconeRecord } from "@pinecone-database/pinecone";
import { EmbeddingPayload } from "../types/rag.types";

interface UpsertDocumentVectorsParams {
    documentId: string;
    contentHash: string;
    originalFileName: string;
    namespace?: string;
    vectors: EmbeddingPayload[];
}

export class PineconeIndexService {
    private readonly pinecone: Pinecone;
    private readonly indexName: string;
    private readonly defaultNamespace: string;

    constructor() {
        const apiKey = process.env.PINECONE_API_KEY;
        const indexName = process.env.PINECONE_INDEX_NAME;

        if (!apiKey)
            throw new Error("Missing PINECONE_API_KEY");
        if (!indexName)
            throw new Error("Missing PINECONE_INDEX_NAME");

        this.pinecone = new Pinecone({ apiKey });
        this.indexName = indexName;
        this.defaultNamespace = process.env.PINECONE_NAMESPACE ?? "default";
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

    async deleteByDocumentId(documentId: string, namespace?: string): Promise<void> {
        const resolvedNamespace = this.getNamespace(namespace);
        const index = this.pinecone.Index(this.indexName).namespace(resolvedNamespace);


        await index.deleteMany({
            filter: {
                documentId: {$eq: documentId},
            },
        });
    }
}