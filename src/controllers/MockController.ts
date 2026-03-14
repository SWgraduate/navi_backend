import { Controller, Get, Route, Tags } from 'tsoa';

@Route('mock')
@Tags('Mock')
export class MockController extends Controller {
  /**
   * API 서버 연결 및 라우팅이 정상적으로 동작하는지 확인하기 위한 테스트용 엔드포인트입니다.
   * 고정된 메시지와 현재 서버 시각(타임스탬프)을 반환합니다.
   * 실제 서비스에서는 사용되지 않으며, 개발 및 통합 테스트 목적으로만 활용합니다.
   */
  @Get('test')
  public async test(): Promise<any> {
    return {
      message: 'This is a mock route',
      timestamp: new Date().toISOString(),
    };
  }
}
