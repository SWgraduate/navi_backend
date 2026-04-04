import WebSocket from 'ws';
import { logger } from 'src/utils/log';

export class SpeechService {
  private readonly ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
  
  /**
   * ElevenLabs Text-to-Speech (웹소켓 연결 예시)
   * @param voiceId - 사용할 음성 ID
   * @param text - 변환할 텍스트
   * @param onAudioChunk - 오디오 청크를 받을 콜백 함수
   */
  public async generateSpeechStream(
    voiceId: string, 
    text: string, 
    onAudioChunk: (chunk: Buffer) => void,
    outputFormat: string = 'mp3_44100_128'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=eleven_multilingual_v2&output_format=${outputFormat}`;
      
      const ws = new WebSocket(url, {
        headers: {
          'xi-api-key': this.ELEVENLABS_API_KEY,
        },
      });

      ws.on('open', () => {
        logger.i('ElevenLabs TTS WebSocket Connected');
        
        ws.send(JSON.stringify({
          text: ' ',
          voice_settings: { stability: 0.5, similarity_boost: 0.8, speed: 1 },
        }));

        ws.send(JSON.stringify({ text }));
        ws.send(JSON.stringify({ text: '' }));
      });

      ws.on('message', (data: Buffer) => {
        const responseData = data.toString();
        // logger.d("Received data length:", responseData.length); // 디버깅용
        
        try {
          const response = JSON.parse(responseData);
          
          // 오류 발생시 (API Key 오류, 할당량 초과 등)
          if (response.error) {
              logger.e('ElevenLabs API Error in stream:', response.error);
              ws.close();
              resolve();
              return;
          }

          if (response.audio) {
            const audioBuffer = Buffer.from(response.audio, 'base64');
            onAudioChunk(audioBuffer);
          }
          
          if (response.isFinal) {
             logger.i('TTS Stream ended');
             ws.close();
             resolve();
          }
        } catch (e) {
           logger.e("Failed to parse JSON message", e);
        }
      });

      ws.on('error', (error) => {
        logger.e('ElevenLabs TTS Error:', error);
        reject(error);
      });

      ws.on('close', () => {
        resolve();
      });
    });
  }

  /**
   * ElevenLabs Speech-to-Text (웹소켓 연결 예시)
   * @param onTranscript - 인식된 텍스트를 받을 콜백 함수 (text: 문자열, isFinal: 문장 완성 여부)
   * @returns 오디오 버퍼를 주입할 수 있는 객체
   */
  public recognizeSpeechStream(
    onTranscript: (text: string, isFinal: boolean) => void
  ): { pushAudio: (buffer: Buffer) => void; close: () => void } {
    // commit_strategy=vad: 침묵 감지 시 자동으로 committed_transcript 전송
    // audio_format, language_code: 쿼리파라미터로 세션 설정 전달 (클라이언트 초기화 메시지 불필요)
    const url = [
      'wss://api.elevenlabs.io/v1/speech-to-text/realtime',
      '?model_id=scribe_v2_realtime',
      '&commit_strategy=vad',
      '&audio_format=pcm_16000',
      '&language_code=ko',
    ].join('');

    const ws = new WebSocket(url, {
      headers: {
        'xi-api-key': this.ELEVENLABS_API_KEY,
      },
    });

    ws.on('open', () => {
      logger.i('ElevenLabs STT WebSocket Connected (commit_strategy=vad)');
      // 세션 설정은 쿼리파라미터로 전달하므로 별도 초기화 메시지 불필요
    });

    ws.on('message', (data: Buffer) => {
      const response = JSON.parse(data.toString());

      switch (response.message_type) {
        case 'session_started':
          logger.i(`STT Session started | session_id=${response.session_id}`);
          break;
        case 'partial_transcript':
          onTranscript(response.text, false);
          break;
        case 'committed_transcript':
        case 'committed_transcript_with_timestamps':
          logger.i(`STT committed: "${response.text}"`);
          onTranscript(response.text, true);
          break;
        case 'error':
        case 'auth_error':
        case 'quota_exceeded':
        case 'rate_limited':
        case 'resource_exhausted':
          logger.e(`ElevenLabs STT [${response.message_type}]:`, response.error);
          ws.close();
          break;
        default:
          logger.d(`ElevenLabs STT unknown message_type: ${response.message_type}`);
      }
    });

    ws.on('error', (error) => {
      logger.e('ElevenLabs STT WebSocket Error:', error);
    });

    return {
      pushAudio: (buffer: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            message_type: 'input_audio_chunk',
            audio_base_64: buffer.toString('base64'),
            commit: false,        // vad 모드에서 VAD가 자동 처리하므로 false
            sample_rate: 16000,  // required 필드
          }));
        }
      },
      close: () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }
    };
  }
}