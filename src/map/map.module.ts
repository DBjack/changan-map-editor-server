import { Module } from '@nestjs/common';
import { MapController } from './map.controller';
import { LayerService } from './map.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LayerEntity } from 'src/entity/layerEntity';

@Module({
  imports: [TypeOrmModule.forFeature([LayerEntity])],
  controllers: [MapController],
  providers: [LayerService],
})
export class MapModule {}
