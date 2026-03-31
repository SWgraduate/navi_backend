import { MarkdownTextSplitter, RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChunkPayload } from "../types/rag.types";
import { logger } from "src/utils/log";

export class TextChunkingService {
    private readonly chunkSize: number;
    private readonly chunkOverlap: number;

    constructor(chunkSize = 1000, chunkOverlap = 200) {
        if (chunkSize <= 0) {
            throw new Error("chunkSize must be greater than 0");
        }
        if (chunkOverlap >= chunkSize) {
            throw new Error("chunkOverlap must be less than chunkSize");
        }

        this.chunkSize = chunkSize;
        this.chunkOverlap = chunkOverlap;
    }

    async chunkDocument(
        params: {
            documentId: string;
            contentHash: string;
            normalizedText: string;
            mimeType?: string;
        }
    ): Promise<ChunkPayload[]> {
        try {
            if (!params.normalizedText?.trim()) {
                throw new Error("Cannot chunk empty text");
            }

            const isMarkdown = params.mimeType === 'text/markdown';

            logger.i(
                `Chunking document ${params.documentId} (size: ${params.normalizedText.length} chars, ` +
                `chunkSize: ${this.chunkSize}, overlap: ${this.chunkOverlap}, ` +
                `splitter: ${isMarkdown ? 'markdown' : 'recursive'})`
            );

            const splitter = isMarkdown
                ? new MarkdownTextSplitter({ chunkSize: this.chunkSize, chunkOverlap: this.chunkOverlap })
                : new RecursiveCharacterTextSplitter({ chunkSize: this.chunkSize, chunkOverlap: this.chunkOverlap });

            const rawChunks = await splitter.splitText(params.normalizedText);

            const chunks = rawChunks.map((text, chunkIndex) => ({
                chunkId: `${params.documentId}::${params.contentHash.slice(0, 12)}::${chunkIndex}`,
                chunkIndex,
                text,
            }));

            logger.i(`Created ${chunks.length} chunks from document ${params.documentId}`);

            return chunks;
        } catch (error) {
            logger.e(`Text chunking failed for document ${params.documentId}`, error);
            throw new Error(
                `Failed to chunk text: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}