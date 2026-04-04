작성일: 2026-04-04
작성자: Antigravity
이전 버전: VOICE_WEBSOCKET_API.md (2026-03-28)

# Voice Session WebSocket API 가이드 v2

> **v2 변경 사유**: 2026-04-04 ElevenLabs STT Realtime API 공식 스펙 검토 결과,  
> 기존 구현의 프로토콜 오류로 인해 STT → LLM → TTS 파이프라인이 동작하지 않는 버그 발견 및 수정.

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
  ├─► ChatService.generateDirectAnswer()  ← RAG + LLM
  │
  └─► ElevenLabs TTS Streaming
        MP3 청크 → 클라이언트로 Binary 전송
```

---

## 2. 클라이언트 ↔ 백엔드 WebSocket 규격

### 2.1. 연결 흐름

1. **JWT 토큰으로 세션 발급**: `POST /api/chat/{chatId}/voice-session` (Authorization 헤더 필수)
2. **반환값**: `{ token: string, wsUrl: string }`
3. **WebSocket 연결**: `ws://{host}/ws/chats/voice?token={token}`
4. **만료 정책**: 토큰 발급 후 **60초** 이내 연결 필수. 초과 시 자동 소멸.

### 2.2. Client → Server (Upstream)

| 항목 | 내용 |
|---|---|
| **타입** | Binary (ArrayBuffer) |
| **포맷** | PCM 16-bit, Mono, **16kHz** |
| **설명** | 마이크 입력 오디오 스트림을 실시간으로 전송 |

### 2.3. Server → Client (Downstream)

클라이언트는 `typeof event.data`로 수신 타입을 구분합니다.

#### A. 오디오 바이너리 (TTS 출력)

| 항목 | 내용 |
|---|---|
| **타입** | Binary (ArrayBuffer) |
| **포맷** | MP3 (`mp3_44100_128`) |
| **설명** | LLM 답변을 TTS 변환한 스트리밍 청크. 청크 단위로 순차 수신. |

#### B. 상태 이벤트 (JSON String)

**STT 인식 결과** (`type: 'stt'`)
```json
{
  "type": "stt",
  "transcript": "인식된 텍스트",
  "isFinal": false
}
```
- `isFinal: false` → 중간 인식 결과 (계속 갱신됨)
- `isFinal: true` → 발화 확정. 이 시점에 LLM → TTS 파이프라인 시작.

**TTS 텍스트 이벤트** (`type: 'tts'`)
```json
{
  "type": "tts",
  "text": "LLM이 생성한 답변 전체 문자열"
}
```
- 오디오 바이너리 스트리밍 직전에 전송됨. UI 자막 표시용.

---

## 3. 백엔드 ↔ ElevenLabs 내부 구현 스펙

> 이 섹션은 서버 측 `SpeechService.ts` 구현을 위한 레퍼런스입니다.

### 3.1. STT: ElevenLabs Scribe v2 Realtime

**Endpoint**: `wss://api.elevenlabs.io/v1/speech-to-text/realtime`

#### 연결 쿼리 파라미터 (필수)

| 파라미터 | 값 | 설명 |
|---|---|---|
| `model_id` | `scribe_v2_realtime` | 사용 모델 |
| `commit_strategy` | **`vad`** | ⚠️ 핵심. `manual`(기본값)이면 `committed_transcript`가 자동으로 오지 않음 |
| `audio_format` | `pcm_16000` | 오디오 포맷 |
| `language_code` | `ko` | 인식 언어 |

> **⚠️ 주의**: `commit_strategy`의 기본값은 `manual`입니다.  
> `manual` 모드에서는 클라이언트가 `commit: true`를 명시적으로 전송해야만 `committed_transcript`가 발급됩니다.  
> **`vad` 모드를 사용해야** 침묵 감지 시 자동으로 발화를 확정하여 파이프라인이 이어집니다.

#### 인증

쿼리파라미터가 아닌 **헤더**로 전달:
```
xi-api-key: {ELEVENLABS_API_KEY}
```

#### 초기화 메시지

**별도 초기화 메시지 불필요.** 세션 설정은 모두 연결 쿼리파라미터로 전달됩니다.  
(구버전 구현의 `session_started` 메시지 전송은 스펙에 없는 동작이었음)

#### Client → ElevenLabs: InputAudioChunk

```json
{
  "message_type": "input_audio_chunk",
  "audio_base_64": "<base64 인코딩된 PCM 데이터>",
  "commit": false,
  "sample_rate": 16000
}
```

> **⚠️ 주의**: `commit`과 `sample_rate`는 **required** 필드입니다.  
> `vad` 모드에서는 `commit: false`로 고정하면 VAD가 자동으로 처리합니다.

#### ElevenLabs → Client: 수신 이벤트

| `message_type` | 설명 |
|---|---|
| `session_started` | 세션 초기화 완료. `session_id` 포함. |
| `partial_transcript` | 중간 인식 결과. `text` 필드. 계속 갱신됨. |
| `committed_transcript` | **발화 확정**. `isFinal=true` 트리거. LLM 호출 시작. |
| `committed_transcript_with_timestamps` | 타임스탬프 포함 발화 확정 (선택적). |
| `error` / `auth_error` / `quota_exceeded` / `rate_limited` / `resource_exhausted` | 오류 이벤트. `error` 필드에 상세 메시지. |

### 3.2. TTS: ElevenLabs Stream Input

**Endpoint**: `wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input`

쿼리파라미터: `model_id=eleven_multilingual_v2&output_format=mp3_44100_128`

#### 메시지 시퀀스

```
1. 연결 직후 (InitializeConnection)
   { "text": " ", "voice_settings": { "stability": 0.5, "similarity_boost": 0.8, "speed": 1 } }

2. 본문 텍스트 전송 (SendText)
   { "text": "<LLM 답변 전체>" }

3. 종료 신호 (CloseConnection)
   { "text": "" }
```

#### ElevenLabs → 백엔드: 수신 이벤트

- `audio` (string, base64): MP3 청크. `Buffer.from(response.audio, 'base64')`로 디코딩하여 클라이언트로 전달.
- `isFinal` (boolean): 스트림 종료 여부.

---

## 4. 예외 및 생명주기 (Lifecycle & Errors)

| 상황 | 동작 |
|---|---|
| 유효하지 않은 토큰으로 WS 연결 시도 | Close Code `1008` 반환 및 즉시 차단 |
| 클라이언트 `close` 이벤트 발생 | 서버 측 STT 스트림 즉시 종료 및 세션 메모리 해제 |
| STT 오류 발생 | `logger.e`로 기록, 세션 유지 (종료하지 않음) |
| TTS 오류 발생 | `logger.e`로 기록, `resolve()`로 graceful 처리 |

---

## 5. 구버전(v1) 대비 변경 사항 요약

| 항목 | v1 (2026-03-28) | v2 (2026-04-04) |
|---|---|---|
| STT `commit_strategy` | 미설정 (기본값 `manual`) | `vad` 명시 → 자동 발화 확정 |
| STT 초기화 메시지 | `open` 시 `session_started` 메시지 전송 (비표준) | 제거. 쿼리파라미터로 대체 |
| `InputAudioChunk.commit` | 없음 (required 필드 누락) | `false` 명시 |
| `InputAudioChunk.sample_rate` | 없음 (required 필드 누락) | `16000` 명시 |
| STT 에러 처리 | `ws.on('error')` 만 | `message_type` 별 에러 이벤트 처리 추가 |
| 파이프라인 동작 여부 | ❌ `committed_transcript` 미수신으로 LLM/TTS 미동작 | ✅ 정상 동작 확인 |
