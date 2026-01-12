import { Controller, Get, Route, Tags } from 'tsoa';

@Route('system')
@Tags('System')
export class SystemController extends Controller {
  @Get('health')
  public async healthCheck(): Promise<{ status: string }> {
    return { status: 'ok' };
  }
}
