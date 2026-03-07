import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { logger } from "src/utils/log";

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
    public async processDocument(content: string, metadata: Record<string, any> = {}): Promise<number> {
        try {
            // 1. Chunking
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });

            const docs = await splitter.createDocuments([content], [metadata]);
            logger.i(`[VectorStore] Split into ${docs.length} chunks`);

            // 2. Embedding & Storage
            const embeddings = new OpenAIEmbeddings({
                modelName: process.env.EMBEDDING_MODEL,
                configuration: {
                    baseURL: process.env.OPENROUTER_BASE_URL,
                    apiKey: process.env.OPENROUTER_API_KEY,
                },
            });

            const index = this.pinecone.Index(this.indexName);

            // Store documents in Pinecone
            await PineconeStore.fromDocuments(docs, embeddings, {
                pineconeIndex: index,
                maxConcurrency: 5,
            });

            logger.s(`[VectorStore] Successfully stored ${docs.length} chunks in Pinecone`);
            return docs.length;
        } catch (error) {
            logger.e("[VectorStore] Error processing document:", error);
            throw error;
        }
    }
}