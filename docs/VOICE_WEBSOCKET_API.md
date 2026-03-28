작성일: 2026-03-28
작성자: Antigravity

# Voice Session WebSocket API 가이드

## 1. 연결 흐름 (Connection Flow)
1. **토큰 발급**: `POST /api/chat/{chatId}/voice-session` 호출 (JWT 인증 필수)
2. **반환값 확인**: `{ token, wsUrl }` 수신
3. **웹소켓 연결**: 획득한 `wsUrl` 기반으로 WebSocket 연결 수립 (예: `ws://.../ws/chats/voice?token={token}`)
4. **만료 정책**: 토큰 발급 후 60초 이내 연결 필수. 시간 초과 시 자동 만료.

## 2. 프미티브 송수신 규격 (Data Protocol)

### 2.1. Client → Server (Upstream)
* **타입**: 바이너리 (Binary)
* **내용**: 사용자 마이크 입력 오디오 스트림
* **오디오 규격**: PCM 16-bit, Mono, 16kHz

### 2.2. Server → Client (Downstream)
오디오 출력과 상태 텍스트를 혼합 전송. 클라이언트에서 `typeof event.data`를 통해 분기 처리 필요.

#### A. 오디오 데이터 (바이너리)
* **타입**: 바이너리 (`ArrayBuffer` / `Blob`)
* **내용**: LLM 답변을 변환한 TTS 스트림 청크
* **오디오 규격**: MP3

#### B. 상태 이벤트 (JSON String)
* **STT 이벤트**: 사용자 음성 인식 결과 (명시/완료)
  ```json
  {
    "type": "stt",
    "transcript": "인식된 텍스트 내용",
    "isFinal": true // 최종 인식 완료 여부 (false 시 중간 결과)
  }
  ```
* **TTS 이벤트**: LLM 답변 생성 결과 (오디오 재생 전 시각화용)
  ```json
  {
    "type": "tts",
    "text": "LLM이 생성한 전체 문자열"
  }
  ```

## 3. 예외 및 종료 (Lifecycle & Errors)
* **토큰 검증 실패**: 유효하지 않은 토큰 접근 시 Close Code `1008` 반환 및 즉시 차단.
* **자원 회수**: 클라이언트의 WebSocket `close` 이벤트 발생 시 서버 측 STT 파이프라인 및 스트림 메모리 즉시 해제.
