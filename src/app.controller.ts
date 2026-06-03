import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@Controller()
@ApiTags('默认')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({ summary: '欢迎接口', description: '返回服务欢迎信息' })
  @ApiResponse({ status: 200, description: '成功返回欢迎信息' })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
