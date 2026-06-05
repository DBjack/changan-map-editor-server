import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 确定状态码和错误信息
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();

      // 处理 ValidationPipe 的详细错误信息
      if (exception instanceof BadRequestException) {
        const responseBody = exception.getResponse();
        if (typeof responseBody === 'object' && responseBody !== null) {
          // 提取 class-validator 的详细错误信息
          const errors = (responseBody as any).message;
          if (Array.isArray(errors)) {
            message = errors.join('; ');
          } else if (typeof errors === 'string') {
            message = errors;
          } else {
            message = (responseBody as any).message || exception.message;
          }
        } else {
          message = exception.message;
        }
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // 统一错误响应格式
    const errorResponse = {
      code: status,
      message,
      data: null,
      timestamp: new Date().toISOString(),
      path: (request as any).url,
    };

    response.status(status).json(errorResponse);
  }
}
