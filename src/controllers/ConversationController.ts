import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Path,
  Post,
  Query,
  Request,
  Response,
  Route,
  Security,
  Tags,
} from "tsoa";
import { Request as ExRequest } from "express";
import { ConversationService } from "src/services/ConversationService";

interface CreateConversationRequest {
  title?: string;
}

interface RenameConversationRequest {
  title: string;
}

@Route("chat/conversations")
@Tags("Chat")
export class ConversationController extends Controller {
  private conversationService = ConversationService.getInstance();

  private getUserIdOrUnauthorized(req: ExRequest): string | null {
    const userId = req.user;
    if (!userId) {
        this.setStatus(401);
        return null;
    }
    return userId;
  }

  @Post("/")
  @Security("jwt")
  @Response<{ error: string }>(401, "Unauthorized")
  @Response<{ error: string }>(400, "Bad Request")
  public async createConversation(
    @Body() body: CreateConversationRequest,
    @Request() req: ExRequest
  ): Promise<{ conversationId: string } | { error: string }> {
    const userId = this.getUserIdOrUnauthorized(req);
    if (!userId) {
      return { error: "Unauthorized" };
    }

    try {
      const result = await this.conversationService.createConversation(userId, body?.title);
      this.setStatus(201);
      return result;
    } catch (error: unknown) {
      this.setStatus(400);
      return { error: error instanceof Error ? error.message : "Failed to create conversation" };
    }
  }

  @Get("/")
  @Security("jwt")
  @Response<{ error: string }>(401, "Unauthorized")
  public async listConversations(
    @Request() req: ExRequest,
    @Query() searchQuery?: string
  ): Promise<{ conversations: unknown[] } | { error: string }> {
    const userId = this.getUserIdOrUnauthorized(req);
    if (!userId) {
      return { error: "Unauthorized" };
    }

    const conversations = searchQuery?.trim()
      ? await this.conversationService.searchConversations(userId, searchQuery)
      : await this.conversationService.listConversations(userId);

    return { conversations };
  }

  @Patch("/{conversationId}/title")
  @Security("jwt")
  @Response<{ error: string }>(401, "Unauthorized")
  @Response<{ error: string }>(404, "Not Found")
  @Response<{ error: string }>(400, "Bad Request")
  public async renameConversation(
    @Path() conversationId: string,
    @Body() body: RenameConversationRequest,
    @Request() req: ExRequest
  ): Promise<{ message: string } | { error: string }> {
    const userId = this.getUserIdOrUnauthorized(req); 
    if (!userId) {
      return { error: "Unauthorized" };
    }

    try {
      await this.conversationService.renameConversation(userId, conversationId, body.title);
      return { message: "Conversation renamed" };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to rename conversation";
      this.setStatus(message === "Conversation not found" ? 404 : 400);
      return { error: message };
    }
  }

  @Delete("/{conversationId}")
  @Security("jwt")
  @Response<{ error: string }>(401, "Unauthorized")
  @Response<{ error: string }>(404, "Not Found")
  public async deleteConversation(
    @Path() conversationId: string,
    @Request() req: ExRequest
  ): Promise<{ message: string } | { error: string }> {
    const userId = this.getUserIdOrUnauthorized(req);
    if (!userId) {
      return { error: "Unauthorized" };
    }

    try {
      await this.conversationService.deleteConversation(userId, conversationId);
      return { message: "Conversation deleted" };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete conversation";
      this.setStatus(message === "Conversation not found" ? 404 : 400);
      return { error: message };
    }
  }

  @Get("/{conversationId}/messages")
  @Security("jwt")
  @Response<{ error: string }>(401, "Unauthorized")
  @Response<{ error: string }>(404, "Not Found")
  public async getConversationMessages(
    @Path() conversationId: string,
    @Request() req: ExRequest
  ): Promise<{ messages: unknown[] } | { error: string }> {
    const userId = this.getUserIdOrUnauthorized(req);
    if (!userId) {
      return { error: "Unauthorized" };
    }

    try {
      const messages = await this.conversationService.getConversationMessages(userId, conversationId);
      return { messages };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to get conversation messages";
      this.setStatus(message === "Conversation not found" ? 404 : 400);
      return { error: message };
    }
  }
}
