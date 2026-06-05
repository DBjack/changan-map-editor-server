import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LayerModule } from './layer/layer.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseInitService } from './common/database-init.service';

@Module({
  imports: [
    // 加载环境变量
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // 配置数据库连接
    TypeOrmModule.forRootAsync({
      //使用工厂函数配置数据库连接参数，根据环境变量动态配置
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 3306),
        username: configService.get('DB_USERNAME', 'root'),
        password: configService.get('DB_PASSWORD', 'Root@123456'),
        database: configService.get('DB_DATABASE', 'layer'),
        entities: ['dist/**/*.entity{.ts,.js}', 'dist/**/*Entity{.ts,.js}'],
        autoLoadEntities: true, // 自动加载实体类
        synchronize: configService.get('DB_SYNC', 'true') === 'true', // 开发环境建议开启，生产环境建议关闭,自动同步数据库表结构
      }),
      inject: [ConfigService],
    }),
    LayerModule,
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseInitService],
})
export class AppModule {}
