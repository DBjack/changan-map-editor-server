import { Injectable } from '@nestjs/common';
import { UpdateLayerDto } from 'src/dto/Layer';
import { AppResponse } from 'src/common/response';

@Injectable()
export class LayerService {
  getLayer() {
    return 'layer';
  }

  updateLayer(layer: UpdateLayerDto) {
    return AppResponse.success({
      layerId: layer.layerId,
      layerList: layer.layerList,
    });
  }

  addLayer() {
    return 'add layer';
  }

  deleteLayer() {
    return 'delete layer';
  }
}
