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

  @Post("/")
  @Response<{ error: string }>(401, "Unauthorized")
  @Response<{ error: string }>(400, "Bad Request")
  public async createConversation(
    @Body() body: CreateConversationRequest,
    @Request() req: ExRequest
  ): Promise<{ conversationId: string } | { error: string }> {
    const userId = req.session.userId;
    if (!userId) {
      this.setStatus(401);
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
  @Response<{ error: string }>(401, "Unauthorized")
  public async listConversations(
    @Request() req: ExRequest,
    @Query() q?: string
  ): Promise<{ conversations: unknown[] } | { error: string }> {
    const userId = req.session.userId;
    if (!userId) {
      this.setStatus(401);
      return { error: "Unauthorized" };
    }

    const conversations = q?.trim()
      ? await this.conversationService.searchConversations(userId, q)
      : await this.conversationService.listConversations(userId);

    return { conversations };
  }

  @Patch("/{conversationId}/title")
  @Response<{ error: string }>(401, "Unauthorized")
  @Response<{ error: string }>(404, "Not Found")
  @Response<{ error: string }>(400, "Bad Request")
  public async renameConversation(
    @Path() conversationId: string,
    @Body() body: RenameConversationRequest,
    @Request() req: ExRequest
  ): Promise<{ message: string } | { error: string }> {
    const userId = req.session.userId;
    if (!userId) {
      this.setStatus(401);
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
  @Response<{ error: string }>(401, "Unauthorized")
  @Response<{ error: string }>(404, "Not Found")
  public async deleteConversation(
    @Path() conversationId: string,
    @Request() req: ExRequest
  ): Promise<{ message: string } | { error: string }> {
    const userId = req.session.userId;
    if (!userId) {
      this.setStatus(401);
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
  @Response<{ error: string }>(401, "Unauthorized")
  @Response<{ error: string }>(404, "Not Found")
  public async getConversationMessages(
    @Path() conversationId: string,
    @Request() req: ExRequest
  ): Promise<{ messages: unknown[] } | { error: string }> {
    const userId = req.session.userId;
    if (!userId) {
      this.setStatus(401);
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