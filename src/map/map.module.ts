import { Module } from '@nestjs/common';
import { MapController } from './map.controller';
import { LayerService } from './map.service';

@Module({
  controllers: [MapController],
  providers: [LayerService],
})
export class MapModule {}
