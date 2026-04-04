import { authStore } from './authStore';

export interface VoiceSessionResponse {
  token: string;
  wsUrl: string;
}

/**
 * 백엔드에 음성 세션 토큰을 요청합니다.
 * authStore에서 JWT를 자동으로 가져와 Authorization 헤더에 주입합니다.
 *
 * @param chatId - 음성 통화를 할 채팅방 ID (임시로 'test' 사용 가능)
 */
export const createVoiceSession = async (chatId: string): Promise<VoiceSessionResponse> => {
  const response = await fetch(`/api/chat/${encodeURIComponent(chatId)}/voice-session`, {
    method: 'POST',
    headers: { ...authStore.authHeaders() },
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create voice session: ${err}`);
  }
  return response.json();
};

/**
 * 발급받은 토큰으로 웹소켓 연결 URL을 생성합니다.
 * Vite 개발 서버 프록시를 통해 ws://localhost:8000 으로 연결됩니다.
 */
export const buildWebSocketUrl = (token: string): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host; // Vite dev server (localhost:5173) 에서 ws 프록시 처리
  return `${protocol}//${host}/ws/chats/voice?token=${token}`;
};
