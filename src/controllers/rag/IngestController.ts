import { Body, Controller, Post, Route, Tags, Request, UploadedFile, FormField } from 'tsoa';
import { VectorStoreService } from '@/services/rag/VectorStoreService';
import { FileService } from '@/services/rag/FileService';
import multer from 'multer';
import express from 'express';
// Configure Multer (Memory Storage)
const upload = multer({ storage: multer.memoryStorage() });
export interface IngestRequest {
    text: string;
    metadata?: Record<string, any>;
}
interface IngestResponse {
    message: string;
    chunks: number;
}
@Route('ingest')
@Tags('Ingest')
export class IngestController extends Controller {
    private vectorStoreService = VectorStoreService.getInstance();
    private fileService = FileService.getInstance();
    // 1. Existing Text Ingest
    @Post('/')
    public async ingestDocument(@Body() body: IngestRequest): Promise<IngestResponse> {
        const { text, metadata } = body;
        try {
            const chunkCount = await this.vectorStoreService.processDocument(text, metadata);
            return { message: 'Text processed successfully', chunks: chunkCount };
        } catch (error) {
            this.setStatus(500);
            throw error;
        }
    }
    // 2. File Upload Ingest
    // Note: TSOA handles file uploads differently. 
    // For simplicity with Express + TSOA, we often rely on standard Express middleware for the actual file handling
    // or define the file param specifically.

    @Post('/upload')
    public async uploadDocument(
        @UploadedFile() file: Express.Multer.File,
        @FormField() source?: string
    ): Promise<IngestResponse> {
        if (!file) {
            this.setStatus(400);
            return { message: 'No file uploaded', chunks: 0 };
        }
        try {
            // Extract extension
            const extension = '.' + file.originalname.split('.').pop()?.toLowerCase();

            // Extract text
            const text = await this.fileService.extractTextFromBuffer(file.buffer, extension);

            // Ingest
            const metadata = {
                source: source || file.originalname,
                originalName: file.originalname,
                mimeType: file.mimetype
            };
            const chunkCount = await this.vectorStoreService.processDocument(text, metadata);

            return {
                message: `File ${file.originalname} processed successfully`,
                chunks: chunkCount
            };
        } catch (error) {
            console.error('Upload error:', error);
            this.setStatus(500);
            throw error;
        }
    }
}