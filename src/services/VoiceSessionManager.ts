import crypto from 'crypto';
import { WebSocket } from 'ws';
import { GLOBAL_CONFIG } from 'src/settings';
import { logger } from 'src/utils/log';
import { ChatService } from './ChatService';
import { SpeechService } from './SpeechService';

interface VoiceSession {
  chatId: string;
  userId: string;
  token: string;
  ws?: WebSocket;
  sttInstance?: ReturnType<typeof SpeechService.prototype.recognizeSpeechStream>;
  createdAt: Date;
}

export class VoiceSessionManager {
  private static instance: VoiceSessionManager;
  private sessions = new Map<string, VoiceSession>(); // key: token
  private speechService = new SpeechService();

  private constructor() {}

  public static getInstance(): VoiceSessionManager {
    if (!VoiceSessionManager.instance) {
      VoiceSessionManager.instance = new VoiceSessionManager();
    }
    return VoiceSessionManager.instance;
  }

  /**
   * REST API에서 호출: 클라이언트가 음성 통화를 시작한다고 알리면 세션 토큰을 발급
   */
  public createSession(chatId: string, userId: string = 'dummy-user-id'): string {
    const token = crypto.randomUUID();
    this.sessions.set(token, {
      chatId,
      userId,
      token,
      createdAt: new Date()
    });

    // 참고: 만약 1~2분 내에 WS 연결이 안 되면 메모리 누수 방지를 위해 지우는 타이머를 설정해둘 수 있습니다.
    setTimeout(() => {
        const session = this.sessions.get(token);
        if (session && !session.ws) {
            logger.i(`[VoiceSession] Token expired without connection: ${token}`);
            this.sessions.delete(token);
        }
    }, 60 * 1000); 

    return token;
  }

  /**
   * WebSocket 서버 초기화 시 호출: 클라이언트가 ws://.../ws/chats/voice?token=... 로 붙을 때
   */
  public handleConnection(ws: WebSocket, token: string) {
    const session = this.sessions.get(token);
    if (!session) {
      logger.w(`[VoiceSession] Invalid token attempted: ${token}`);
      ws.close(1008, 'Invalid token');
      return;
    }

    session.ws = ws;
    logger.i(`[VoiceSession] WS Connected: [Token] ${token} for [ChatID] ${session.chatId}`);

    // ElevenLabs STT 연결 초기화
    session.sttInstance = this.speechService.recognizeSpeechStream((text, isFinal) => {
      // ✅ 부분 인식 / 최종 인식 텍스트 프론트로 전송
      if (session.ws && session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify({ type: 'stt', transcript: text, isFinal }));
      }

      if (isFinal) {
        const trimmedText = (text || '').trim();
        logger.i(`[VoiceSession] STT Final Identified: ${trimmedText}`);
        
        if (trimmedText.length === 0) {
          logger.i(`[VoiceSession] Empty transcript ignored.`);
          return;
        }

        // RAG 기반 ChatService로 질문을 넘기고 LLM의 답변을 받아옵니다.
        this.processQueryToLLMToTTS(session, trimmedText);
      }
    });

    ws.on('message', (message: Buffer) => {
       // 클라이언트 프론트엔드의 녹음기(WebRTC/AudioWorklet)가 잘라보내는 PCM 청크
       if (session.sttInstance) {
           session.sttInstance.pushAudio(message);
       }
    });

    ws.on('close', () => {
       logger.i(`[VoiceSession] WS Disconnected: ${token}`);
       if (session.sttInstance) {
           session.sttInstance.close();
       }
       this.sessions.delete(token);
    });

    ws.on('error', (err) => {
       logger.e(`[VoiceSession] WS Error: ${err}`);
    });
  }

  /**
   * 사용자의 음성이 완성 문장으로 인식되면 LLM을 통해 답변을 가져오고 이를 TTS로 변환합니다.
   */
  private async processQueryToLLMToTTS(session: VoiceSession, text: string) {
    const voiceId = GLOBAL_CONFIG.elevenlabsVoiceId; 
    
    try {
        // 실제 ChatService를 이용해 응답을 가져옵니다. (RAG 검색 포함)
        const chatService = ChatService.getInstance();
        
        logger.i(`[VoiceSession] Querying LLM for: ${text}`);
        const replyText = await chatService.generateDirectAnswer(text);
        logger.i(`[VoiceSession] LLM Response: ${replyText}`);

        // UI에서 TTS 텍스트 결과를 눈으로 볼 수 있게 프론트로 전달
        if (session.ws && session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(JSON.stringify({ type: 'tts', text: replyText }));
        }

        // 생성된 답변을 다시 TTS 음성으로 변환하여 스트리밍 전송
        await this.speechService.generateSpeechStream(
            voiceId, 
            replyText, 
            (chunk) => {
                if (session.ws && session.ws.readyState === WebSocket.OPEN) {
                    session.ws.send(chunk);
                }
            }, 
            'mp3_44100_128' 
        );
        logger.i(`[VoiceSession] TTS Stream finished playing for LLM reply.`);
    } catch(err) {
        logger.e(`[VoiceSession] Query/TTS Error: ${err}`);
    }
  }
}
