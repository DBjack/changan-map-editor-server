import { Injectable } from '@nestjs/common';
import { UpdateLayerDto } from 'src/dto/Layer';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { LayerEntity } from 'src/entity/layerEntity';
import { AppResponse } from 'src/common/response';

@Injectable()
export class LayerService {
  constructor(
    @InjectRepository(LayerEntity)
    private readonly layerRepository: Repository<LayerEntity>,
  ) {}

  // 获取图层接口
  getLayer(id: string) {
    if (!id) {
      return AppResponse.error('图层ID不能为空');
    }
    const result = this.layerRepository.findBy({ id: Number(id) });
    return result;
  }

  // 更新图层接口
  async updateLayer(layer: UpdateLayerDto) {
    if (!layer.id) {
      return AppResponse.error('图层ID不能为空');
    }
    let result = {};
    result = await this.layerRepository.save({
      id: Number(layer.id),
      layer_info: layer.layerInfo,
    });

    return result;
  }

  // 删除图层接口
  async deleteLayer(id: string) {
    if (!id) {
      return AppResponse.error('图层ID不能为空');
    }
    const result = await this.layerRepository.delete(Number(id));
    return result;
  }
}
