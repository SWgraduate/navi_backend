import WebSocket from 'ws';

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
        console.log('ElevenLabs TTS WebSocket Connected');
        
        ws.send(JSON.stringify({
          text: ' ',
          voice_settings: { stability: 0.5, similarity_boost: 0.8, speed: 1 },
        }));

        ws.send(JSON.stringify({ text }));
        ws.send(JSON.stringify({ text: '' }));
      });

      ws.on('message', (data: Buffer) => {
        const responseData = data.toString();
        // console.log("Received data length:", responseData.length); // 디버깅용
        
        try {
          const response = JSON.parse(responseData);
          
          // 오류 발생시 (API Key 오류, 할당량 초과 등)
          if (response.error) {
              console.error('ElevenLabs API Error in stream:', response.error);
              ws.close();
              resolve();
              return;
          }

          if (response.audio) {
            const audioBuffer = Buffer.from(response.audio, 'base64');
            onAudioChunk(audioBuffer);
          }
          
          if (response.isFinal) {
             console.log('TTS Stream ended');
             ws.close();
             resolve();
          }
        } catch (e) {
           console.log("Failed to parse JSON message", e);
        }
      });

      ws.on('error', (error) => {
        console.error('ElevenLabs TTS Error:', error);
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
    const url = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime`;
    
    const ws = new WebSocket(url, {
      headers: {
        'xi-api-key': this.ELEVENLABS_API_KEY,
      },
    });

    ws.on('open', () => {
      console.log('ElevenLabs STT WebSocket Connected');
      
      ws.send(JSON.stringify({
        message_type: 'session_started',
        config: {
          sample_rate: 16000,
          audio_format: 'pcm_16000',
          language_code: 'ko',
        }
      }));
    });

    ws.on('message', (data: Buffer) => {
      const response = JSON.parse(data.toString());
      
      if (response.message_type === 'partial_transcript') {
        onTranscript(response.text, false);
      } else if (response.message_type === 'committed_transcript') {
        onTranscript(response.text, true);
      }
    });

    ws.on('error', (error) => {
      console.error('ElevenLabs STT Error:', error);
    });

    return {
      pushAudio: (buffer: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            message_type: 'input_audio_chunk',
            audio_base_64: buffer.toString('base64')
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