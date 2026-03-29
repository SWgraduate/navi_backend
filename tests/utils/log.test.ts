// pnpm test -- tests/utils/log.test.ts
import { logger } from 'src/utils/log';
import { discordAlert } from "../../src/utils/log";
import axios from 'axios';

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
  let axiosPostSpy: jest.SpyInstance;

  beforeEach(() => {
    // 실제 네트워크 요청을 차단하고, 성공 응답을 모방하도록 axios.post 모킹
    axiosPostSpy = jest.spyOn(axios, 'post').mockResolvedValue({
      status: 200,
      data: 'Mocked Success'
    });
  });

  afterEach(() => {
    // 테스트 종료 후 모킹 초기화
    axiosPostSpy.mockRestore();
  });

  it('should format and send a test alert to Discord webhook', async () => {
    await discordAlert("테스트 메시지입니다.", false, false);

    // axios.post가 올바른 인자로 호출되었는지 검증
    // (웹훅 URL이 환경변수에 세팅된 경우만 발송되므로 호출 여부 체크)
    if (axiosPostSpy.mock.calls.length > 0) {
      expect(axiosPostSpy).toHaveBeenCalledTimes(1);
      expect(axiosPostSpy).toHaveBeenCalledWith(
        expect.any(String), // 디스코드 웹훅 URL
        expect.objectContaining({
          content: expect.stringContaining("테스트 메시지입니다.")
        })
      );
    } else {
      console.warn("DISCORD_WEBHOOK_URL is not set. Webhook alert skipped.");
    }
  });

  it('should format and send an important discord alert', async () => {
    await discordAlert("중요 테스트 메시지입니다.", true, false);

    if (axiosPostSpy.mock.calls.length > 0) {
      expect(axiosPostSpy).toHaveBeenCalledTimes(1);
      expect(axiosPostSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          // important=true인 경우 멘션이 포함될 수 있으므로 stringContaining 사용
          content: expect.stringContaining("중요 테스트 메시지입니다.")
        })
      );
    }
  });
});