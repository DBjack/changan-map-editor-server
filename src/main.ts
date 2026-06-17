import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TransformInterceptor } from './common/transform.interceptor';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

    // 注册全局验证管道
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true, // 仅允许 DTO 中定义的属性
        forbidNonWhitelisted: true, // 禁止传递未定义的属性
        transform: true, // 自动将请求体转换为 DTO 类型
      }),
    );

    // 注册全局响应拦截器
    app.useGlobalInterceptors(new TransformInterceptor());

    // 注册全局异常过滤器
    app.useGlobalFilters(new AllExceptionsFilter());

    // 设置全局 API 前缀
    app.setGlobalPrefix(process.env.API_PREFIX || 'v1');

    // 生产环境不启用 Swagger（可通过环境变量控制）
    const isProd = process.env.NODE_ENV === 'production';
    const enableSwagger = process.env.ENABLE_SWAGGER !== 'false';

    if (!isProd || enableSwagger) {
      const config = new DocumentBuilder()
        .setTitle('长安地图编辑器 API')
        .setDescription('机器人地图编辑后端服务 API 文档')
        .setVersion('1.0.0')
        .addTag('图层', '图层管理接口')
        .addTag('默认', '默认接口')
        .build();

      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api-docs', app, document);
    }

    await app.listen(process.env.PORT ?? 3000);
    console.log(`应用已启动在 http://localhost:${process.env.PORT ?? 3000}`);
    if (!isProd || enableSwagger) {
      console.log(
        `Swagger 文档地址：http://localhost:${process.env.PORT ?? 3000}/api-docs`,
      );
    }
  } catch (error) {
    console.error('启动失败:', (error as Error).message);
    process.exit(1);
  }
}
void bootstrap();
