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
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 3306),
        username: configService.get('DB_USERNAME', 'root'),
        password: configService.get('DB_PASSWORD', 'Root@123456'),
        database: configService.get('DB_DATABASE', 'layer'),
        entities: ['dist/**/*.entity{.ts,.js}', 'dist/**/*Entity{.ts,.js}'],
        autoLoadEntities: true,
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
