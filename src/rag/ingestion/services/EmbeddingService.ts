import { OpenAIEmbeddings } from "@langchain/openai";
import { GLOBAL_CONFIG, OPENROUTER_API_KEY } from "src/settings";
import { ChunkPayload, EmbeddingPayload } from "../types/rag.types";

// Take the chunks and converts it into vector form 

export class EmbeddingService {
  private readonly modelName: string;
  private readonly embeddings: OpenAIEmbeddings;

  constructor() {
    this.modelName = GLOBAL_CONFIG.embeddingModel;

    this.embeddings = new OpenAIEmbeddings({
      model: this.modelName,
      configuration: {
        baseURL: GLOBAL_CONFIG.llmBaseUrl,
        apiKey: OPENROUTER_API_KEY,
      },
    });
  }

  getModelName(): string {
    return this.modelName;
  }

  // for semantic search
  async embedQuery(query: string): Promise<number[]> {
    const vector = await this.embeddings.embedQuery(query);
    if (!vector || vector.length === 0) {
      throw new Error("Failed to generate query embedding");
    }
    return vector;
  }

  async embedChunks(chunks: ChunkPayload[]): Promise<EmbeddingPayload[]> {
    if (chunks.length === 0) {
      return [];
    }

    const vectors = await this.embeddings.embedDocuments(
      chunks.map((chunk) => chunk.text)
    );

    if (vectors.length !== chunks.length) {
      throw new Error(`Embedding result length mismatch. chunks=${chunks.length}, vectors=${vectors.length}`);
    }

    return chunks.map((chunk, index) => {
      const values = vectors[index];
      if (!values) {
        throw new Error(`Missing embedding vector at index ${index}`);
      }

      return {
        chunkId: chunk.chunkId,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        values,
      }
    })
  }
}

// To do: Add batching in `embedChunks` -- to avoid request-size/rate-limit