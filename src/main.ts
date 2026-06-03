import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
}
bootstrap();
