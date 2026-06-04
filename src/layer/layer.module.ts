import { Module } from '@nestjs/common';
import { LayerController } from './layer.controller';
import { LayerService } from './layer.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LayerEntity } from 'src/entity/layerEntity';

@Module({
  imports: [TypeOrmModule.forFeature([LayerEntity])],
  controllers: [LayerController],
  providers: [LayerService],
})
export class LayerModule {}
