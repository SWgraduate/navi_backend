import { Body, Controller, Delete, Get, Path, Post, Query, Request, Route, Security, Tags, } from "tsoa";
import { AttachmentContextService } from "src/services/AttachmentContextService";

interface BindDocumentRequest {
    conversationId: string;
    documentId: string;
}

@Route("chat/context")
@Tags("Chat")
@Security("jwt")
export class ChatContextController extends Controller {
    private readonly attachmentContextService = AttachmentContextService.getInstance();

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