export interface RetrievedChunk {
    chunkId: string;
    documentId: string;
    chunkIndex: number;
    score: number;
    fileName?: string;
    contentHash?: string;
    text?: string;
}

export interface RetrieveContextParams {
    query: string;
    topK?: number;
    namespace?: string;
    minScore?: number;
}

export interface RetrieveContextResult {
    query: string;
    topK: number;
    usedChunks: number;
    chunks: RetrievedChunk[];
}