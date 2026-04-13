import React, { useState, useRef, useEffect, useCallback } from 'react';
import { buildWebSocketUrl, createVoiceSession } from '../../api/voiceApi';

type CallStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface LogEntry {
  time: string;
  type: 'info' | 'send' | 'recv' | 'error';
  message: string;
}

const CHAT_ID_FOR_TEST = 'voice-test-session';
const SAMPLE_RATE = 16000;

export const VoicePanel: React.FC = () => {
  const [chatId, setChatId] = useState(CHAT_ID_FOR_TEST);
  const [status, setStatus] = useState<CallStatus>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentTtsText, setCurrentTtsText] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    setLogs(prev => [...prev.slice(-99), { time, type, message }]);
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 수신된 오디오 바이너리를 큐에 넣고 순차 재생
  const playNextChunk = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;

    const chunk = audioQueueRef.current.shift()!;
    try {
      const ctx = new AudioContext();
      const audioBuffer = await ctx.decodeAudioData(chunk);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        isPlayingRef.current = false;
        ctx.close();
        playNextChunk();
      };
      source.start();
    } catch {
      // mp3 청크가 불완전할 수 있으므로 조용히 넘김
      isPlayingRef.current = false;
      playNextChunk();
    }
  }, []);

  const handleConnect = async () => {
    if (status !== 'idle' && status !== 'error') return;

    try {
      setStatus('connecting');
      addLog('info', `[${chatId}] 음성 세션 토큰 요청 중...`);

      // authStore에서 JWT를 자동으로 가져와 헤더에 주입
      const session = await createVoiceSession(chatId);
      addLog('info', `토큰 발급 성공: ${session.token.slice(0, 8)}...`);

      const wsUrl = buildWebSocketUrl(session.token);
      addLog('info', `WebSocket 연결 시도: ${wsUrl}`);

      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        addLog('info', '✅ WebSocket 연결 성공! 마이크 버튼을 눌러 통화를 시작하세요.');
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          addLog('recv', `오디오 청크 수신 (${event.data.byteLength} bytes)`);
          audioQueueRef.current.push(event.data);
          playNextChunk();
        } else if (typeof event.data === 'string') {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'stt') {
              if (parsed.isFinal) addLog('recv', `STT 완료: ${parsed.transcript}`);
              setCurrentTranscript(parsed.transcript);
            } else if (parsed.type === 'tts') {
              addLog('recv', `TTS 답변 생성됨: ${parsed.text}`);
              setCurrentTtsText(parsed.text);
            } else {
              addLog('recv', `텍스트 수신: ${JSON.stringify(parsed)}`);
            }
          } catch {
            addLog('recv', `텍스트 수신: ${event.data}`);
          }
        }
      };

      ws.onerror = (e) => {
        addLog('error', `WebSocket 오류 발생: ${JSON.stringify(e)}`);
        setStatus('error');
      };

      ws.onclose = (e) => {
        addLog('info', `WebSocket 연결 종료 (code: ${e.code}, reason: ${e.reason || '없음'})`);
        setStatus('idle');
        stopRecording();
      };
    } catch (err) {
      addLog('error', `연결 실패: ${err instanceof Error ? err.message : String(err)}`);
      setStatus('error');
    }
  };

  const startRecording = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addLog('error', '먼저 WebSocket을 연결해주세요.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;

      // AudioContext + ScriptProcessorNode로 PCM 16kHz 스트리밍
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;

        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        wsRef.current.send(int16.buffer);
        addLog('send', `PCM 청크 전송 (${int16.byteLength} bytes)`);
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      setIsRecording(true);
      addLog('info', '🎙️ 녹음 시작! 말씀해 주세요...');
    } catch (err) {
      addLog('error', `마이크 접근 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const stopRecording = () => {
    processorRef.current?.disconnect();
    audioContextRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());

    processorRef.current = null;
    audioContextRef.current = null;
    mediaStreamRef.current = null;

    setIsRecording(false);
    addLog('info', '🛑 녹음 중지');
  };

  const handleDisconnect = () => {
    stopRecording();
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('idle');
    setCurrentTranscript('');
    setCurrentTtsText('');
    addLog('info', '연결을 종료했습니다.');
  };

  const handleClearLogs = () => setLogs([]);

  const statusColor: Record<CallStatus, string> = {
    idle: '#8e8ea0',
    connecting: '#f0a500',
    connected: '#10a37f',
    error: '#ef4444',
  };

  const statusLabel: Record<CallStatus, string> = {
    idle: '● 대기 중',
    connecting: '◌ 연결 중...',
    connected: '● 연결됨',
    error: '✕ 오류',
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '24px',
      gap: '16px',
      overflowY: 'auto',
      color: 'var(--text-primary)',
    }}>
      <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>🎙️ Voice Pipeline 테스트</h2>
      <p style={{ margin: 0, fontSize: '0.85rem', color: '#8e8ea0' }}>
        STT → RAG LLM → TTS 전체 파이프라인을 실시간으로 테스트합니다.
      </p>

      {/* 설정 및 연결 패널 */}
      <div style={{
        background: 'var(--input-bg)',
        borderRadius: '10px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        border: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.85rem', color: '#8e8ea0', minWidth: '60px' }}>Chat ID</label>
          <input
            value={chatId}
            onChange={e => setChatId(e.target.value)}
            disabled={status !== 'idle' && status !== 'error'}
            placeholder="테스트용 채팅방 ID"
            style={{
              flex: 1,
              minWidth: '180px',
              padding: '8px 12px',
              background: 'var(--bg-color)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: '#fff',
              outline: 'none',
              fontSize: '0.9rem',
            }}
          />
          <span style={{ color: statusColor[status], fontSize: '0.85rem', fontWeight: 600 }}>
            {statusLabel[status]}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleConnect}
            disabled={status === 'connecting' || status === 'connected'}
            style={btnStyle('#10a37f', status === 'connecting' || status === 'connected')}
          >
            연결
          </button>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={status !== 'connected'}
            style={btnStyle(isRecording ? '#ef4444' : '#f0a500', status !== 'connected')}
          >
            {isRecording ? '🛑 녹음 중지' : '🎙️ 녹음 시작'}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={status === 'idle'}
            style={btnStyle('#8e8ea0', status === 'idle')}
          >
            연결 종료
          </button>
          <button onClick={handleClearLogs} style={btnStyle('#565869', false)}>
            로그 지우기
          </button>
        </div>
      </div>

      {/* STT/TTS 결과 표시 */}
      {(currentTranscript || currentTtsText) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {currentTranscript && (
            <div style={{
              background: 'rgba(16,163,127,0.1)',
              border: '1px solid #10a37f',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.9rem',
            }}>
              <span style={{ color: '#10a37f', fontWeight: 600 }}>🗣️ (나) STT 인식: </span>
              {currentTranscript}
            </div>
          )}
          {currentTtsText && (
            <div style={{
              background: 'rgba(240,165,0,0.1)',
              border: '1px solid #f0a500',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '0.9rem',
            }}>
              <span style={{ color: '#f0a500', fontWeight: 600 }}>🤖 (AI) TTS 답변: </span>
              {currentTtsText}
            </div>
          )}
        </div>
      )}

      {/* 디버그 로그 패널 */}
      <div style={{
        flex: 1,
        background: '#1a1a2e',
        borderRadius: '10px',
        padding: '12px',
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: '0.78rem',
        minHeight: '200px',
        border: '1px solid var(--border-color)',
      }}>
        {logs.length === 0 ? (
          <div style={{ color: '#565869' }}>로그가 없습니다. "연결" 버튼을 눌러 시작하세요.</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} style={{ marginBottom: '4px', lineHeight: '1.5' }}>
              <span style={{ color: '#565869' }}>[{log.time}] </span>
              <span style={{ color: logColor(log.type) }}>{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};

const btnStyle = (color: string, disabled: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  background: disabled ? 'transparent' : color,
  border: `1px solid ${disabled ? '#4D4D4F' : color}`,
  borderRadius: '6px',
  color: disabled ? '#565869' : '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '0.85rem',
  fontWeight: 600,
  transition: 'all 0.2s',
});

const logColor = (type: LogEntry['type']): string => {
  switch (type) {
    case 'send': return '#f0a500';
    case 'recv': return '#10a37f';
    case 'error': return '#ef4444';
    default: return '#ececf1';
  }
};
