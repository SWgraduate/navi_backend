import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";

export class VectorStoreService {
    private static instance: VectorStoreService;
    private pinecone: Pinecone; 
    private indexName: string;

    private constructor() {
        const apiKey = process.env.PINECONE_API_KEY;
        const indexName = process.env.PINECONE_INDEX_NAME;

        if (!apiKey || !indexName) {
            throw new Error("VectorDB API key or Index name is missing.\nConfigure that in .env file!");
        } 

        this.pinecone = new Pinecone({
            apiKey: apiKey
        });
        this.indexName = indexName;
    }

    public static getInstance(): VectorStoreService {
        if (!VectorStoreService.instance) {
            VectorStoreService.instance = new VectorStoreService();
        }
        return VectorStoreService.instance;
    }

    // Process Text
    public async processDocument(
        content: string, 
        metadata: Record<string, any> = {},
        documentId: string,
        docHash: string
    ): Promise<number> {
        try {
            // 1. Chunking
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });

            // Metadata
            const enhancedMetadata = {
                ...metadata, 
                documentId,
                docHash
            };

            const docs = await splitter.createDocuments([content], [enhancedMetadata]);
            console.log(`[VectorStore] Split into ${docs.length} chunks`);

            // 2. Embedding & Storage
            const embeddings = new OpenAIEmbeddings({
                modelName: process.env.EMBEDDING_MODEL,
                configuration: {
                    baseURL: process.env.OPENROUTER_BASE_URL,
                    apiKey: process.env.OPENROUTER_API_KEY,
                },
            });

            const index = this.pinecone.Index(this.indexName);
            const store = new PineconeStore(embeddings, { pineconeIndex: index });

            // Generate deterministic IDs based on the documentId and chunk index
            const documentIds = docs.map((_, index) => `${documentId}_chunk_${index}`);

            // Use .addDocuments with specific IDs instead of .fromDocuments
            await store.addDocuments(docs, { ids: documentIds });

            console.log(`[VectorStore] Successfully stored ${docs.length} chunks in Pinecone`);
            return docs.length;
        } catch (error) {
            console.error("[VectorStore] Error processing document:", error);
            throw error;
        }
    }
}