import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TransformInterceptor } from './common/transform.interceptor';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

    // 注册全局响应拦截器
    app.useGlobalInterceptors(new TransformInterceptor());

    const config = new DocumentBuilder()
      .setTitle('长安地图编辑器 API')
      .setDescription('机器人地图编辑后端服务 API 文档')
      .setVersion('1.0.0')
      .addTag('地图', '地图相关接口')
      .addTag('默认', '默认接口')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    await app.listen(process.env.PORT ?? 3000);
    console.log(`应用已启动在 http://localhost:${process.env.PORT ?? 3000}`);
  } catch (error) {
    console.error('启动失败:', error.message);
    process.exit(1);
  }
}
bootstrap();
