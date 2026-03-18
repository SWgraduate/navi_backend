import { Controller, Get, Route, Tags } from 'tsoa';

@Route('system')
@Tags('System')
export class SystemController extends Controller {
  /**
   * 서버의 현재 동작 상태를 확인합니다.
   * 서버가 정상적으로 실행 중인 경우 `{ status: 'ok' }`를 반환합니다.
   * 로드 밸런서 또는 모니터링 도구에서 서버 헬스 체크 용도로 사용됩니다.
   */
  @Get('health')
  public async healthCheck(): Promise<{ status: string }> {
    return { status: 'ok' };
  }
}
