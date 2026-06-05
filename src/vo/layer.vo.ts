// 图层响应 VO（View Object）
export class LayerVO {
  id: number;
  layerInfo: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;

  // 从实体转换为 VO
  static fromEntity(entity: any): LayerVO {
    const vo = new LayerVO();
    vo.id = entity.id;
    vo.layerInfo = entity.layer_info;
    return vo;
  }

  // 批量转换
  static fromEntities(entities: any[]): LayerVO[] {
    return entities.map(entity => LayerVO.fromEntity(entity));
  }
}
