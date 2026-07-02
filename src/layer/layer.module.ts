import { Module } from '@nestjs/common';
import { LayerController } from './layer.controller';
import { LayerService } from './layer.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LayerEntity } from 'src/entity/layerEntity';
import { RedisModule } from 'src/common/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([LayerEntity]), RedisModule],
  controllers: [LayerController],
  providers: [LayerService],
})
export class LayerModule {}
