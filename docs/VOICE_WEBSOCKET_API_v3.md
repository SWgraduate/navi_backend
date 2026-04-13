작성일: 2026-04-13
작성자: Antigravity
이전 버전: [VOICE_WEBSOCKET_API_v2.md](./VOICE_WEBSOCKET_API_v2.md) (2026-04-04)

# Voice Session WebSocket API 가이드 v3

> **v3 변경 사유**: ElevenLabs TTS API의 Unusual Activity 차단 이슈로 인해 **Typecast(타입캐스트) TTS SDK**로 엔진 마이그레이션.  
> 또한, 음성 대화 UX 최적화를 위해 LLM 답변 길이를 1문장으로 제한하는 가이드 추가.

---

## 1. 전체 파이프라인 개요

```
클라이언트 (브라우저)
  │
  │ PCM 16kHz 오디오 스트림 (Binary)
  ▼
백엔드 WebSocket (/ws/chats/voice?token=...)
  │
  ├─► ElevenLabs STT Realtime
  │     VAD 침묵 감지 시 → committed_transcript 이벤트
  │
  ├─► ChatService.generateDirectAnswer()  ← RAG + LLM (Voice Mode)
  │     ※ 음성 최적화: 1문장 내외의 짧은 구어체 답변 생성
  │
  └─► Typecast TTS Streaming (SDK)
        MP3 스트리밍 청크 → 클라이언트로 Binary 전송
```

---

## 2. 클라이언트 ↔ 백엔드 WebSocket 규격

### 2.1. 연결 흐름
(v2와 동일)
1. **JWT 토큰으로 세션 발급**: `POST /api/chat/{chatId}/voice-session`
2. **WebSocket 연결**: `ws://{host}/ws/chats/voice?token={token}`

### 2.2. Client → Server (Upstream)
(v2와 동일)
- **포맷**: PCM 16-bit, Mono, **16kHz**

### 2.3. Server → Client (Downstream)

#### A. 오디오 바이너리 (TTS 출력)

| 항목 | 내용 |
|---|---|
| **타입** | Binary (ArrayBuffer) |
| **포맷** | **MP3 (320 kbps, 44100 Hz)** |
| **설명** | Typecast 엔진이 생성한 MP3 청크. 각 청크는 독립적으로 디코딩 가능함. |

#### B. 상태 이벤트 (JSON String)
(v2와 동일)

---

## 3. 백엔드 내부 구현 스펙 (마이그레이션 변경점)

### 3.1. STT: ElevenLabs Scribe v2 Realtime
- **현상 유지**: STT는 기존 ElevenLabs 모델 인프라를 그대로 사용함.

### 3.2. TTS: Typecast SDK Streaming
- **엔진**: `@neosapience/typecast-js`
- **모델**: `ssfm-v30` (Multilingual 지원 모델)

#### 연동 특징
1. **간소화된 핸드셰이크**: ElevenLabs와 달리 연결 직후 빈 텍스트(" ")나 초기화 메시지를 보낼 필요가 없음.
2. **ReadableStream 처리**: SDK의 `textToSpeechStream`이 반환하는 `ReadableStream`을 통해 청크를 즉시 클라이언트로 Relay 함.
3. **고음질**: 128kbps에서 320kbps MP3로 품질 향상.

---

## 4. 응답 가이드라인 (Prompting)

음성 대화의 특성상 TTS 출력 시간이 길어지면 UX가 저하되므로, 백엔드는 다음 규칙을 준수하여 답변을 생성함:
- **길이 제한**: 최대 1문장 권장.
- **포맷**: 마크다운, 불릿 포인트, 특수 기호를 배제한 순수 구어체 텍스트.
- **직관성**: 인사말이나 서론을 생략하고 핵심 정보를 먼저 전달.

---

## 5. 구버전(v2) 대비 변경 사항 요약

| 항목 | v2 (2026-04-04) | v3 (2026-04-13) |
|---|---|---|
| **TTS 엔진** | ElevenLabs (WebSocket) | **Typecast (SDK Streaming)** |
| **MP3 품질** | 128 kbps | **320 kbps** |
| **답변 길이** | 제한 없음 (구조화 권장) | **1문장 이내 (단문 권장)** |
| **인정/차단 리스크** | Unusual Activity 차단 이슈 발생 | 안정적인 국내 서비스 API 사용 |
