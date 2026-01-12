import { Controller, Get, Put, Route, Tags } from 'tsoa';

@Route('settings')
@Tags('Settings')
export class SettingsController extends Controller {
  @Get('profile')
  public async getProfile(): Promise<{}> {
    return {};
  }

  @Put('profile')
  public async updateProfile(): Promise<{}> {
    return {};
  }
}
