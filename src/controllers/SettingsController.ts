import { Controller, Get, Put, Route, Tags } from 'tsoa';

@Route('settings')
@Tags('Settings')
export class SettingsController extends Controller {
  /**
   * 현재 로그인된 사용자의 프로필 정보를 조회합니다.
   * 사용자 이름, 이메일 등 프로필과 관련된 정보를 반환합니다.
   */
  @Get('profile')
  public async getProfile(): Promise<{}> {
    return {};
  }

  /**
   * 현재 로그인된 사용자의 프로필 정보를 수정합니다.
   * 변경하려는 프로필 항목(이름, 기타 설정 등)을 요청 본문에 담아 전송하면 업데이트가 적용됩니다.
   */
  @Put('profile')
  public async updateProfile(): Promise<{}> {
    return {};
  }
}
