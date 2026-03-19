// pnpm test -- tests/utils/log.test.ts
import { logger } from 'src/utils/log';
import { discordAlert } from "../../src/utils/log";

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

describe('Discord Alert Test', () => {
  it('should send a test alert to Discord webhook', async () => {
    // 이 테스트는 실제로 디스코드 웹훅에 메시지를 보내는 테스트입니다.
    // 웹훅 URL이 설정되어 있지 않으면 경고 메시지가 출력되고 테스트는 패스됩니다.
    await discordAlert("테스트 메시지입니다.", true, false);
  });
  it('should send important discord alert', async () => {
    await discordAlert("중요 테스트 메시지입니다.", true, false);
  });
});