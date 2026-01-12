import { Controller, Get, Route, Tags } from 'tsoa';

@Route('mock')
@Tags('Mock')
export class MockController extends Controller {
  @Get('test')
  public async test(): Promise<any> {
    return {
      message: 'This is a mock route',
      timestamp: new Date().toISOString(),
    };
  }
}
