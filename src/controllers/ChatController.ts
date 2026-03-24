import { Body, Controller, Get, Path, Post, Route, Tags, Response, Request, Security } from 'tsoa';
import { Request as ExRequest } from 'express';
import { ChatService, ChatTask } from 'src/services/ChatService';

export interface ChatRequest {
  query: string;
  conversationId?: string;
}

export interface ChatTaskResponse {
  taskId: string;
  message: string;
  conversationId?: string;
}

// ChatService의 ChatTask 인터페이스를 사용하거나, 여기서 정의한 것을 사용하고 매핑해야 함.
// 편의상 ChatService의 정의와 일치시킴.
export interface ChatStatusResponse extends ChatTask { }

@Route('chat')
@Tags('Chat')
export class ChatController extends Controller {
  private chatService = ChatService.getInstance();

  /**
   * 사용자의 질문을 전송하고 비동기 처리용 `taskId`를 발급받습니다.
   * 질문은 즉시 처리되지 않고 비동기 작업으로 등록되며, 반환된 `taskId`를 통해
   * `/chat/status/{taskId}` 엔드포인트에서 처리 상태와 결과를 조회할 수 있습니다.
   * @param body 사용자가 입력한 질문 내용 (`query`, optional `conversationId`)
   * @param req JWT 인증 미들웨어 통과한 Express 요청 객체 (req.user에 userId 포함)
   */
  @Post('/')
  @Security("jwt")
  public async createChatTask(
    @Body() body: ChatRequest,
    @Request() req: ExRequest
  ): Promise<ChatTaskResponse | { error: string}> {
    const { query, conversationId } = body;
    const userId = req.user;

    if(!userId) {
        this.setStatus(401);
        return { error: "Authentication required" };
    }

    const result = await this.chatService.startChatTask(query, userId, conversationId);

    this.setStatus(202); // Accepted
    return result;
  }

  /**
   * 특정 `taskId`에 해당하는 채팅 작업의 현재 처리 상태를 조회합니다.
   * 작업이 완료된 경우 AI의 응답 결과를 함께 반환하며, 작업이 존재하지 않으면 404를 반환합니다.
   * 클라이언트는 작업 완료 전까지 폴링(polling) 방식으로 이 엔드포인트를 반복 호출할 수 있습니다.
   * @param taskId `/chat` 엔드포인트에서 발급된 작업 고유 식별자
   */
  @Get('/status/{taskId}')
  @Response<ChatStatusResponse>(200, "Success")
  @Response<{ error: string }>(404, "Task not found")
  public async getChatStatus(@Path() taskId: string): Promise<ChatStatusResponse | { error: string }> {
    const status = await this.chatService.getTaskStatus(taskId);

    if (!status) {
      this.setStatus(404);
      return { error: 'Task not found' };
    }

    return status;
  }
}
