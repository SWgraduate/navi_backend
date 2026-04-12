// 실행 명령어: pnpm tsx tools/testSttFile.ts <파일경로>
// 예시: pnpm tsx tools/test-stt-file.ts my_voice.mp3

import { SpeechService } from '../src/services/SpeechService';
import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

// .env.development 파일 로드
dotenv.config({ path: path.join(__dirname, '../.env.development') });

async function run() {
  const filePath = process.argv[2];
  if (!filePath || !fs.existsSync(filePath)) {
    console.error("❌ 오류: 변환할 오디오 파일 경로를 올바르게 입력해주세요.");
    console.error("사용법: pnpm tsx tools/test-stt-file.ts <mp3/wav/m4a 등의 오디오파일>");
    process.exit(1);
  }

  const service = new SpeechService();
  console.log(`🎙️ 파일 분석 시작: ${filePath}\n`);
  console.log('🔄 STT 웹소켓 연결 중...');

  const stt = service.recognizeSpeechStream((text, isFinal) => {
    if (isFinal) {
      console.log(`\n✅ 확정 문장: ${text}\n`);
    } else {
      process.stdout.write(`\r⏳ 인식 중: ${text}`);
    }
  });

  // 웹소켓 연결 대기
  await new Promise(resolve => setTimeout(resolve, 2000));

  // ffmpeg를 사용하여 오디오 파일을 16000Hz 1채널 PCM raw 데이터로 변환 후 실시간 스트리밍
  const ffmpeg = spawn('ffmpeg', [
    '-i', filePath,
    '-f', 's16le',       // raw PCM format
    '-ac', '1',          // 1 channel
    '-ar', '16000',      // 16000 sample rate
    'pipe:1'             // output to stdout
  ]);

  console.log('▶️ 음성 스트리밍 전송 중...');

  ffmpeg.stdout.on('data', (buffer: Buffer) => {
    stt.pushAudio(buffer);
  });

  ffmpeg.on('close', () => {
    console.log('\n\n✅ 파일 전송 완료. 최종 인식을 기다립니다...');
    setTimeout(() => {
      stt.close();
      console.log('종료합니다.');
      process.exit(0);
    }, 3000);
  });

  ffmpeg.on('error', (err) => {
    console.error('\n❌ ffmpeg 실행 오류 (ffmpeg가 설치되어 있어야 합니다):', err);
    stt.close();
    process.exit(1);
  });
}

run();
