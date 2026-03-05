import { Body, Controller, Get, Path, Post, Route, Tags, Response } from 'tsoa';
import { ChatService, ChatTask } from 'src/services/ChatService';

export interface ChatRequest {
  query: string;
}

export interface ChatTaskResponse {
  taskId: string;
  message: string;
}

// ChatService의 ChatTask 인터페이스를 사용하거나, 여기서 정의한 것을 사용하고 매핑해야 함.
// 편의상 ChatService의 정의와 일치시킴.
export interface ChatStatusResponse extends ChatTask { }

@Route('chat')
@Tags('Chat')
export class ChatController extends Controller {
  private chatService = ChatService.getInstance();

  /**
   * 질문을 전송하고 비동기 처리용 taskId를 발급받는다.
   */
  @Post('/')
  public async createChatTask(@Body() body: ChatRequest): Promise<ChatTaskResponse> {
    const { query } = body;
    const result = await this.chatService.startChatTask(query);
    this.setStatus(202); // Accepted
    return result;
  }

  /**
   * 특정 taskId의 현재 상태를 조회한다.
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
