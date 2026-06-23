import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { UpdateLayerDto } from 'src/dto/Layer';
import { LayerVO } from 'src/vo/layer.vo';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { LayerEntity } from 'src/entity/layerEntity';
import { RedisService } from 'src/common/redis.service';

@Injectable()
export class LayerService {
  private readonly CACHE_KEY_PREFIX = 'layer:';

  constructor(
    @InjectRepository(LayerEntity)
    private readonly layerRepository: Repository<LayerEntity>,
    private readonly redisService: RedisService,
  ) {}

  private getCacheKey(id: string): string {
    return `${this.CACHE_KEY_PREFIX}${id}`;
  }

  // 获取图层接口
  async getLayer(id: string): Promise<LayerVO> {
    if (!id) {
      throw new HttpException('图层 ID 不能为空', HttpStatus.BAD_REQUEST);
    }

    // 先从 Redis 缓存获取
    const cacheKey = this.getCacheKey(id);
    const cached = await this.redisService.getJson<LayerVO>(cacheKey);
    if (cached) {
      return cached;
    }

    // 缓存未命中，从数据库查询
    const result = await this.layerRepository.findOneBy({ id: Number(id) });
    if (!result) {
      throw new HttpException('图层不存在', HttpStatus.NOT_FOUND);
    }

    // 将结果写入 Redis 缓存
    const layerVO = LayerVO.fromEntity(result);
    await this.redisService.setJson(cacheKey, layerVO);

    return layerVO;
  }

  // 更新图层接口
  async updateLayer(layer: UpdateLayerDto): Promise<LayerVO> {
    if (!layer.id) {
      throw new HttpException('图层 ID 不能为空', HttpStatus.BAD_REQUEST);
    }

    // 更新数据库
    const result = await this.layerRepository.save({
      id: Number(layer.id),
      layer_info: layer.layerInfo,
    });

    // 删除缓存，下次查询时重新加载
    const cacheKey = this.getCacheKey(String(layer.id));
    await this.redisService.del(cacheKey);

    return LayerVO.fromEntity(result);
  }

  // 删除图层接口
  async deleteLayer(id: string): Promise<LayerVO> {
    if (!id) {
      throw new HttpException('图层 ID 不能为空', HttpStatus.BAD_REQUEST);
    }

    const layer = await this.getLayer(id);

    // 删除数据库记录
    const result = await this.layerRepository.delete(Number(id));
    if (result.affected === 0) {
      throw new HttpException('删除失败', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // 删除缓存
    const cacheKey = this.getCacheKey(id);
    await this.redisService.del(cacheKey);

    return layer;
  }
}
