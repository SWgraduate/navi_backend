// pnpm test -- tests/utils/log.test.ts
import { logger } from 'src/utils/log';

describe('Logger Display Test', () => {
  it('should visually output logs properly to terminal', () => {
    // 빈 줄을 하나 넣어 테스트 출력 사이에 공간 확보
    logger.i('\n--- logger 출력 테스트 구간 시작 ---');

    logger.d('이것은 **Debug** 로그입니다.');
    logger.i('이것은 **Info** 로그입니다.');
    logger.s('이것은 **Success** 로그입니다.');
    logger.w('이것은 **Warning** 로그입니다.');
    logger.e('이것은 **Error** 로그입니다.');
    logger.c('이것은 **Critical** 로그입니다.');

    logger.i('--- logger 출력 테스트 구간 종료 ---\n');

    // 이 테스트는 단순히 에러 없이 실행되는지만 검증합니다. 
    // 실제 검증은 위 콘솔 출력을 눈으로 확인하는 방식입니다.
    expect(true).toBe(true);
  });
});
