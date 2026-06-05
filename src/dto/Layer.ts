import { IsNotEmpty, IsInt, IsArray } from 'class-validator';

// 更新图层请求 DTO
export class UpdateLayerDto {
  @IsNotEmpty({ message: '图层ID不能为空' })
  @IsInt()
  id: number;

  @IsNotEmpty({ message: '图层信息不能为空' })
  @IsArray({ message: '图层信息必须是数组' })
  layerInfo: Record<string, any>;
}
