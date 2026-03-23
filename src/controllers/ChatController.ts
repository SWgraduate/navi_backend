import { Body, Controller, Get, Path, Post, Route, Tags, Response } from 'tsoa';
import { ChatService, ChatTask } from 'src/services/ChatService';
import { VoiceSessionManager } from 'src/services/VoiceSessionManager';

export interface ChatRequest {
  query: string;
}

export interface ChatTaskResponse {
  taskId: string;
  message: string;
}

export interface VoiceSessionResponse {
  token: string;
  wsUrl: string;
}

// ChatService의 ChatTask 인터페이스를 사용하거나, 여기서 정의한 것을 사용하고 매핑해야 함.
// 편의상 ChatService의 정의와 일치시킴.
export interface ChatStatusResponse extends ChatTask { }

@Route('chat')
@Tags('Chat')
export class ChatController extends Controller {
  private chatService = ChatService.getInstance();
  private voiceSessionManager = VoiceSessionManager.getInstance();

  /**
   * 실시간 음성 통화를 위한 WebSocket 세션 토큰을 발급받습니다.
   * 발급받은 wsUrl로 WebSocket을 연결하여 오디오 스트리밍을 시작할 수 있습니다.
   * @param chatId 통화를 시작할 채팅방 ID
   */
  @Post('/{chatId}/voice-session')
  public async createVoiceSession(@Path() chatId: string): Promise<VoiceSessionResponse> {
    const userId = 'TODO_USER_ID'; // 원래는 인증 미들웨어(req.user) 등에서 가져옵니다
    const token = this.voiceSessionManager.createSession(chatId, userId);

    return {
      token,
      wsUrl: `/ws/chats/voice?token=${token}` 
    };
  }

  /**
   * 사용자의 질문을 전송하고 비동기 처리용 `taskId`를 발급받습니다.
   * 질문은 즉시 처리되지 않고 비동기 작업으로 등록되며, 반환된 `taskId`를 통해
   * `/chat/status/{taskId}` 엔드포인트에서 처리 상태와 결과를 조회할 수 있습니다.
   * @param body 사용자가 입력한 질문 내용 (`query` 필드)
   */
  @Post('/')
  public async createChatTask(@Body() body: ChatRequest): Promise<ChatTaskResponse> {
    const { query } = body;
    const result = await this.chatService.startChatTask(query);
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
