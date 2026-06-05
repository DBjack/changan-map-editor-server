import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { UpdateLayerDto } from 'src/dto/Layer';
import { LayerVO } from 'src/vo/layer.vo';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { LayerEntity } from 'src/entity/layerEntity';

@Injectable()
export class LayerService {
  constructor(
    @InjectRepository(LayerEntity)
    private readonly layerRepository: Repository<LayerEntity>,
  ) {}

  // 获取图层接口
  async getLayer(id: string): Promise<LayerVO> {
    if (!id) {
      throw new HttpException('图层 ID 不能为空', HttpStatus.BAD_REQUEST);
    }
    const result = await this.layerRepository.findOneBy({ id: Number(id) });
    if (!result) {
      throw new HttpException('图层不存在', HttpStatus.NOT_FOUND);
    }
    return LayerVO.fromEntity(result);
  }

  // 更新图层接口
  async updateLayer(layer: UpdateLayerDto): Promise<LayerVO> {
    if (!layer.id) {
      throw new HttpException('图层 ID 不能为空', HttpStatus.BAD_REQUEST);
    }
    const result = await this.layerRepository.save({
      id: Number(layer.id),
      layer_info: layer.layerInfo,
    });
    return LayerVO.fromEntity(result);
  }

  // 删除图层接口
  async deleteLayer(id: string): Promise<LayerVO> {
    if (!id) {
      throw new HttpException('图层 ID 不能为空', HttpStatus.BAD_REQUEST);
    }

    const layer = await this.getLayer(id);

    const result = await this.layerRepository.delete(Number(id));
    if (result.affected === 0) {
      throw new HttpException('删除失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return layer;
  }
}
