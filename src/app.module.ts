import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LayerModule } from './layer/layer.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseInitService } from './common/database-init.service';
import { RedisModule } from './common/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      // 加载环境变量
      isGlobal: true, // 全局配置,代表这是一个全局配置模块,可以在任何地方使用
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
    }),
    TypeOrmModule.forRootAsync({
      // 异步加载数据库配置，用forRootAsync方法是因为TypeOrmModule.forRoot方法是同步的，而数据库配置是异步的，需要确保在数据库配置完成后加载数据库模块
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 3306),
        username: configService.get('DB_USERNAME', 'root'),
        password: configService.get('DB_PASSWORD', 'Root@123456'),
        database: configService.get('DB_DATABASE', 'layer'),
        autoLoadEntities: true, // 自动加载TypeOrmModule.forFeature方法中指定的实体类
        synchronize: configService.get('DB_SYNC', 'true') === 'true',
      }),
      inject: [ConfigService],
    }),
    RedisModule,
    LayerModule,
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseInitService],
})
export class AppModule {}
