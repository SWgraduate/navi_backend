import { Body, Controller, Get, Path, Post, Route, Tags } from 'tsoa';

export interface ChatRequest {
  query: string;
}

export interface ChatTaskResponse {
  taskId: string;
  message: string;
}

export interface ChatStatusResponse {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  displayMessage: string;
  result?: any;
}

@Route('chat')
@Tags('Chat')
export class ChatController extends Controller {
  /**
   * 질문을 전송하고 비동기 처리용 taskId를 발급받는다.
   */
  @Post('/')
  public async createChatTask(@Body() body: ChatRequest): Promise<ChatTaskResponse> {
    const { query } = body;
    // TODO: 실제 task 생성 로직
    return {
      taskId: 'dummy-task-id',
      message: `Received: ${query}`,
    };
  }

  /**
   * 특정 taskId의 현재 상태를 조회한다.
   */
  @Get('/status/{taskId}')
  public async getChatStatus(@Path() taskId: string): Promise<ChatStatusResponse> {
    // TODO: 실제 상태 조회 로직
    return {
      status: 'processing',
      displayMessage: '관련 문서를 읽고 있습니다...',
    };
  }
}
