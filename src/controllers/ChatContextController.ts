import { Body, Controller, Delete, Get, Path, Post, Query, Request, Route, Security, Tags, UploadedFile } from "tsoa";
import { AttachmentContextService } from "src/services/AttachmentContextService";
import { RagIngestionService } from "src/rag/ingestion/services/RagIngestionService";
import { IngestDocumentResult } from "src/rag/ingestion/types/rag.types";
import { GLOBAL_CONFIG } from "src/settings";

interface BindDocumentRequest {
    conversationId: string;
    documentId: string;
}

@Route("chat/context")
@Tags("Chat")
@Security("jwt")
export class ChatContextController extends Controller {
    private readonly attachmentContextService = AttachmentContextService.getInstance();
    private readonly ragIngestionService = new RagIngestionService();
    
    @Post("/documents")
    public async uploadUserDocument(
        @Request() request: any,
        @UploadedFile() file: Express.Multer.File,
    ): Promise<IngestDocumentResult> {
        if (!file) {
            this.setStatus(400);
            throw new Error("No file uploaded");
        }

        const userId = request.user.userId;
        const result = await this.ragIngestionService.ingestDocument({
            fileBuffer: file.buffer,
            originalFileName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            namespace: GLOBAL_CONFIG.pineconeUserDocsNamespace,
            actor: { userId, role: "user" },
        });

        this.setStatus(result.isDuplicate ? 200 : 201);
        return result;
    }

    // Bind a document to a conversation
    @Post("/attachments")
    public async bindDocument(
        @Request() request: any,
        @Body() body: BindDocumentRequest
    ): Promise<{ message: string }> {
        const userId = request.user.userId;
        await this.attachmentContextService.bindDocument(userId, body.conversationId, body.documentId);
        this.setStatus(201);
        return { message: "Document bound successfully" };
    }

    // List all documents bound to a conversation
    @Get("/attachments")
    public async listBoundDocuments(
        @Request() request: any,
        @Query() conversationId: string
    ): Promise<{ documentId: string; createdAt: Date }[]> {
        const userId = request.user.userId;
        const bindigs = await this.attachmentContextService.listBoundDocuments(userId, conversationId);
        return bindigs.map(binding => ({ documentId: binding.documentId, createdAt: binding.createdAt}));
    }

    // Unbind a document from a conversation
    @Delete("/attachments/{documentId}")
    public async unbindDocument(
        @Request() request: any,
        @Path() documentId: string,
        @Query() conversationId: string
    ): Promise<{ message: string }> {
        const userId = request.user.userId;
        await this.attachmentContextService.unbindDocument(userId, conversationId, documentId);
        return { message: "Document unbound successfully" };
    } 
}