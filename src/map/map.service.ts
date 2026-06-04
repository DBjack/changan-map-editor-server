import { Injectable } from '@nestjs/common';
import { UpdateLayerDto } from 'src/dto/Layer';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { LayerEntity } from 'src/entity/layerEntity';

@Injectable()
export class LayerService {
  constructor(
    @InjectRepository(LayerEntity)
    private readonly layerRepository: Repository<LayerEntity>,
  ) {}

  // 获取场景图层接口
  getLayer(mapid: number) {
    const result = this.layerRepository.findBy({ id: mapid });
    return result;
  }

  // 更新图层接口
  async updateLayer(layer: UpdateLayerDto) {
    let result = {};
    result = await this.layerRepository.save({
      id: Number(layer.id),
      layer_info: layer.layerInfo,
    });

    return result;
  }

  // addLayer() {
  //   return 'add layer';
  // }

  // 删除图层接口
  async deleteLayer(mapid: number) {
    const result = await this.layerRepository.delete(mapid);
    return result;
  }
}
