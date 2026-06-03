import { Injectable } from '@nestjs/common';
import { UpdateLayerDto } from 'src/dto/Layer';
import { AppResponse } from 'src/common/response';
import { Repository } from 'typeorm';
import { Layer } from 'src/entities/Layer';

@Injectable()
export class LayerService {
  constructor(private readonly layerRepository: Repository<Layer>) {}

  getLayer() {
    return 'layer';
  }

  async updateLayer(layer: UpdateLayerDto) {
    const result = await this.layerRepository.update(layer.id, {
      layerList: layer.layerList,
    });
    return AppResponse.success(result);
  }

  addLayer() {
    return 'add layer';
  }

  deleteLayer() {
    return 'delete layer';
  }
}
