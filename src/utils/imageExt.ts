import sharp from 'sharp';
import { logger } from './log';

/**
 * Base64 인코딩된 이미지를 받아 크기와 용량을 최적화하여 다시 Base64로 반환합니다.
 * @param base64Str 원본 Base64 이미지 해시
 * @param maxWidth 최대 너비 (기본값: 1500px, LLM의 인식률을 위해 너무 작지 않은 적절한 크기)
 * @returns 최적화된 Base64 문자열
 */
export const optimizeBase64Image = async (base64Str: string, maxWidth = 1500): Promise<string> => {
  try {
    // 1. Data URI scheme 형태 (data:image/jpeg;base64,...) 처리
    let base64Data = base64Str;
    let mimeType = 'image/jpeg';
    let prefix = '';

    const matches = base64Str.match(/^data:(image\/[A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches[1] && matches[2]) {
      prefix = `data:${matches[1]};base64,`;
      mimeType = matches[1];
      base64Data = matches[2];
    }

    // 2. Base64 -> Buffer 변환
    const buffer = Buffer.from(base64Data, 'base64');

    // 3. Sharp를 이용해 이미지 리사이즈 및 압축 진행
    // width 기준 maxWidth으로 줄이되, 원본이 이보다 작으면 원본 크기 유지 (withoutEnlargement)
    const optimizedBuffer = await sharp(buffer)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .jpeg({ quality: 80 }) // 80% 품질 최적화 (가독성 유지하며 용량 절감)
      .toBuffer();

    const optimizedBase64 = optimizedBuffer.toString('base64');
    
    // 비율 계산용 로깅
    const originalMb = (buffer.length / (1024 * 1024)).toFixed(2);
    const optimizedMb = (optimizedBuffer.length / (1024 * 1024)).toFixed(2);
    logger.i(`Vision 용량 최적화: ${originalMb}MB -> ${optimizedMb}MB (` + 
             Math.round((1 - optimizedBuffer.length / buffer.length) * 100) + '% 감소)');

    // 4. 원래 포맷대로 반환
    return prefix ? `${prefix}${optimizedBase64}` : optimizedBase64;
  } catch (error) {
    logger.e('이미지 최적화 중 오류가 발생했습니다:', error);
    // 문제 발생 시 강제 실패보다는 그냥 원본 값을 그대로 리턴
    return base64Str;
  }
};
