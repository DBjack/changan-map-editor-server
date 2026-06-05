import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

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

    // 记录错误日志
    const isProduction = process.env.NODE_ENV === 'production';
    const logMessage = {
      timestamp: new Date().toISOString(),
      url: request.url,
      method: request.method,
      status,
      message,
      stack: isProduction ? undefined : (exception as Error).stack,
    };

    if (status >= 500) {
      this.logger.error('服务器错误', JSON.stringify(logMessage));
    } else if (status >= 400) {
      this.logger.warn('客户端错误', JSON.stringify(logMessage));
    } else {
      this.logger.log('请求完成', JSON.stringify(logMessage));
    }

    // 统一错误响应格式
    const errorResponse: any = {
      code: status,
      message,
      data: null,
      timestamp: new Date().toISOString(),
    };

    // 生产环境隐藏 path 字段，避免信息泄漏
    if (!isProduction) {
      errorResponse.path = request.url;
    }

    response.status(status).json(errorResponse);
  }
}
