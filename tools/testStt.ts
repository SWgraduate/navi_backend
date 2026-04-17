// 실행 명령어: pnpm tsx tools/testStt.ts
import { SpeechService } from '../src/services/SpeechService';
import record from 'node-record-lpcm16';
import dotenv from 'dotenv';
import path from 'path';

// .env.development 파일 로드 (ELEVENLABS_API_KEY 설정 필요)
dotenv.config({ path: path.join(__dirname, '../.env.development') });

/**
 * [주의]
 * 마이크 입력을 받기 위해 시스템에 SoX(Sound eXchange) 프로그램이 설치되어 있어야 합니다.
 * Windows: https://sourceforge.net/projects/sox/ 에서 설치 후 환경 변수(Path)에 추가
 * Mac: brew install sox
 * 패키지 설치 필요: pnpm install node-record-lpcm16
 */
async function run() {
  const service = new SpeechService();
  console.log('🎤 마이크 입력을 시작합니다. (종료: Ctrl+C)');

  // STT 서비스 초기화 및 콜백 등록
  const stt = service.recognizeSpeechStream((text, isFinal) => {
    if (isFinal) {
      console.log(`\n✅ 확정 문장: ${text}`);
    } else {
      process.stdout.write(`\r⏳ 인식 중: ${text}`);
    }
  });

  // 시스템 마이크 녹음 시작 (16000Hz, 1채널 PCM)
  const recording = record.record({
    sampleRate: 16000,
    channels: 1,
    audioType: 'raw',
    // device: process.platform === 'win32' ? 'default' : null, // 주석 처리
    recordProgram: 'sox',
  });

  // 마이크 데이터를 받을 때마다 SpeechService로 전달
  recording.stream().on('data', (data: Buffer) => {
    stt.pushAudio(data);
  });

  // 종료 처리
  process.on('SIGINT', () => {
    console.log('\n종료합니다.');
    stt.close();
    recording.stop();
    process.exit();
  });
}

run();