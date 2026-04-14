// 실행 명령어: pnpm tsx tools/test-stt-e2e.ts
import { SpeechService } from '../src/services/SpeechService';
import { GLOBAL_CONFIG } from '../src/settings';
import dotenv from 'dotenv';
import path from 'path';

// .env.development 파일 로드
dotenv.config({ path: path.join(__dirname, '../.env.development') });

/**
 * STT를 테스트하기 위한 End-to-End 스크립트입니다.
 * 1. Typecast TTS로 텍스트를 MP3 포맷으로 변환
 * 2. 받은 오디오 청크를 ElevenLabs STT로 전송하여 인식 결과를 확인
 * ⚠️ 참고: Typecast TTS는 PCM을 지원하지 않으므로 루프백 정확도가 저하될 수 있음
 */
async function run() {
  const service = new SpeechService();
  
  const testText = "이것은 마이크 없이 텍스트 투 스피치로 생성된 음성을 다시 스피치 투 텍스트로 인식하게 만드는 테스트입니다.";
  const voiceId = GLOBAL_CONFIG.typecastVoiceId;

  console.log(`🔊 원본 텍스트:\n"${testText}"\n`);
  console.log('🔄 STT 웹소켓을 준비합니다...');

  // 1. STT 서비스 초기화
  const stt = service.recognizeSpeechStream((text, isFinal) => {
    if (isFinal) {
      console.log(`\n✅ 최종 인식 문장: ${text}\n`);
    } else {
      process.stdout.write(`\r⏳ 인식 중: ${text}`);
    }
  });

  // STT 웹소켓이 연결될 약간의 시간을 줍니다.
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('🎤 TTS로 음성을 생성하여 실시간으로 STT로 전송합니다...\n');

  // 2. TTS 서비스 호출 (Typecast MP3 스트리밍 → STT로 전송)
  try {
    await service.generateSpeechStream(
      voiceId, 
      testText, 
      (chunk) => {
        // TTS에서 생성된 음성 청크를 바로 STT로 밀어넣음
        stt.pushAudio(chunk);
      },
    );

    console.log('\n\n✅ TTS 오디오 스트림 전송 완료. STT의 최종 인식을 기다립니다...');
    
    // 최종 인식을 기다리기 위해 잠시 대기 후 종료
    setTimeout(() => {
      stt.close();
      console.log('테스트가 완료되었습니다.');
      process.exit(0);
    }, 5000);

  } catch (error) {
    console.error("오류 발생:", error);
    stt.close();
  }
}

run();
