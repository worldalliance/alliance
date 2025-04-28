import { Controller, Get, HttpStatus, HttpCode } from '@nestjs/common';
import { Public } from './auth/public.decorator';
@Controller()
export class AppController {
  constructor() {}

  @Public()
  @Get('/')
  @HttpCode(HttpStatus.OK)
  healthCheck(): string {
    return 'OK';
  }
}
