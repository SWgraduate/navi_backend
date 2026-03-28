import { Body, Controller, Get, Path, Post, Route, Tags, Response, Request, Security } from 'tsoa';
import { Request as ExRequest } from 'express';
import { ChatService, ChatTask } from 'src/services/ChatService';
import { VoiceSessionManager } from 'src/services/VoiceSessionManager';

export interface ChatRequest {
  query: string;
  conversationId?: string;
  hasAttachments?: boolean;
}

export interface ChatTaskResponse {
  taskId: string;
  message: string;
  conversationId?: string;
}

/** 실시간 음성 대화 세션 응답 객체 */
export interface VoiceSessionResponse {
  /** 1회성 세션 인증 토큰 (60초 이내에 WebSocket 연결에 사용해야 함) */
  token: string;
  /** WebSocket 연결을 위한 상대 경로 및 토큰 매개변수 */
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
   * 실시간 음성 대화를 위한 일회성 WebSocket 세션 토큰을 발급받습니다.
   * 발급받은 `wsUrl`을 통해 WebSocket 연결을 수립하면, ElevenLabs STT/TTS 기반의 
   * 음성 대화 파이프라인(오디오 스트리밍)을 시작할 수 있습니다.
   * 
   * 보안을 위해 JWT 인증이 필요하며, 발급된 토큰은 60초 이내에 연결되지 않으면 자동 소멸됩니다.
   * 
   * @param chatId 음성 대화를 진행할 타겟 채팅방 식별자(ID)
   * @param req JWT 인증을 거친 Express 요청 객체 (내부적으로 사용자 ID 식별에 사용)
   */
  @Post('/{chatId}/voice-session')
  @Security('jwt')
  public async createVoiceSession(
    @Path() chatId: string,
    @Request() req: ExRequest
  ): Promise<VoiceSessionResponse> {
    const userId = req.user as string;
    const token = this.voiceSessionManager.createSession(chatId, userId);

    return {
      token,
      wsUrl: `/ws/chats/voice?token=${token}`,
    };
  }

  /**
   * 사용자의 텍스트 질문을 비동기 채팅 작업으로 등록하고 `taskId`를 발급받습니다.
   * 
   * 입력된 질문은 즉시 응답되지 않고 백그라운드에서 RAG(검색 증강 생성) 파이프라인을 통해 처리됩니다.
   * 클라이언트는 반환된 `taskId`를 사용하여 `/chat/status/{taskId}`에서 작업의 진행 상태와 
   * 최종 AI 응답 결과를 확인할 수 있습니다.
   * 
   * @param body 채팅 요청 데이터 (`query`: 질문 내용, `conversationId`: 이전 대화 맥락, `hasAttachments`: 첨부파일 여부)
   * @param req JWT 인증을 거친 Express 요청 객체 (응답 생성 시 사용자 별 권한 확인에 사용)
   */
  @Post('/')
  @Security("jwt")
  public async createChatTask(
    @Body() body: ChatRequest,
    @Request() req: ExRequest
  ): Promise<ChatTaskResponse | { error: string}> {
    const { query, conversationId, hasAttachments } = body;
    const userId = req.user;

    if(!userId) {
        this.setStatus(401);
        return { error: "Authentication required" };
    }

    const result = await this.chatService.startChatTask(query, userId, conversationId, hasAttachments );

    this.setStatus(202); // Accepted
    return result;
  }

  /**
   * 등록된 특정 채팅 작업(`taskId`)의 처리 상태와 결과 데이터를 조회합니다.
   * 
   * 작업이 `pending` 상태일 경우 대기하고, `completed` 상태가 되면 AI의 최종 응답 텍스트를 함께 반환합니다.
   * 클라이언트는 작업이 완료될 때까지 주기적으로 이 엔드포인트를 호출(Polling)하는 구조로 설계되었습니다.
   * 
   * @param taskId `/chat` 엔드포인트에서 발급받은 고유 작업 식별자
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
