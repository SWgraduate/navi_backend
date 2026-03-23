// 실행 명령어: pnpm tsx tools/test-tts.ts
import { SpeechService } from '../src/services/SpeechService';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// .env.development 파일 로드 (ELEVENLABS_API_KEY 설정 필요)
dotenv.config({ path: path.join(__dirname, '../.env.development') });

async function run() {
  const service = new SpeechService();
  
  // 테스트할 텍스트 및 음성 ID
  const text = "안녕하세요? 일레븐랩스 외부 API 연동 텍스트 투 스피치 테스트입니다. 잘 들리시나요?";
  const voiceId = "cgSgspJ2msm6clMCkdW9";
  
  // 루트 디렉토리 아래의 out 폴더로 지정
  const outDir = path.join(__dirname, '../out');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outputPath = path.join(outDir, 'output.mp3');

  console.log(`🔊 다음 텍스트를 음성으로 변환합니다:\n"${text}"\n`);
  
  const writeStream = fs.createWriteStream(outputPath);
  
  try {
    // 음성 변환 (청크가 올 때마다 파일에 쓰기)
    await service.generateSpeechStream(voiceId, text, (chunk) => {
      process.stdout.write('.'); // 스트리밍 진행 상태 표시
      writeStream.write(chunk);
    });

    writeStream.end();
    console.log(`\n✅ 변환 완료! 파일이 생성되었습니다: ${outputPath}`);
  } catch (error) {
    console.error("\n❌ 오류 발생:", error);
  }
}

run();