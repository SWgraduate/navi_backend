import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChunkPayload } from "../types/rag.types";

export class TextChunkingService {
    private readonly chunkSize: number;
    private readonly chunkOverlap: number;

    constructor(chunkSize = 1000, chunkOverlap = 200){
        this.chunkSize = chunkSize,
        this.chunkOverlap = chunkOverlap;
    }

    async chunkDocument(
        params: {
            documentId: string,
            contentHash: string,
            normalizedText: string,
        }
    ): Promise<ChunkPayload[]> {
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: this.chunkSize,
            chunkOverlap: this.chunkOverlap,
        });

        const rawChunks = await splitter.splitText(params.normalizedText);

        return rawChunks.map((text, chunkIndex) => ({
            chunkId: `${params.documentId}::${params.contentHash.slice(0, 12)}::${chunkIndex}`,
            chunkIndex,
            text,
        }));
    }
}