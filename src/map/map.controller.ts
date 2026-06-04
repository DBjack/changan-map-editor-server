import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { LayerService } from './map.service';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UpdateLayerDto } from 'src/dto/Layer';
import { AppResponse } from 'src/common/response';

@Controller('layer')
@ApiTags('场景图层')
export class MapController {
  constructor(private readonly layerService: LayerService) {}

  @ApiOperation({ summary: '获取场景图层', description: '获取场景图层数据' })
  @ApiParam({ name: 'mapid', description: '地图ID' })
  @ApiResponse({ status: 200, description: '成功获取场景图层数据' })
  @Get('list/:mapid')
  getLayer(@Param('mapid') mapid: number) {
    return this.layerService.getLayer(mapid);
  }

  // @ApiOperation({ summary: '添加场景图层', description: '添加场景图层数据' })
  // @ApiParam({ name: 'mapId', description: '地图ID' })
  // @ApiResponse({ status: 200, description: '成功添加场景图层数据' })
  // @Post('add')
  // addLayer() {
  //   return this.layerService.addLayer();
  // }

  @ApiOperation({ summary: '更新场景图层', description: '更新场景图层数据' })
  @ApiBody({ type: UpdateLayerDto })
  @ApiResponse({ status: 200, description: '成功更新场景图层数据' })
  @Post('update')
  updateLayer(@Body() layer: UpdateLayerDto): AppResponse {
    return this.layerService.updateLayer(layer);
  }

  @ApiOperation({ summary: '删除场景图层', description: '删除场景图层数据' })
  @ApiParam({ name: 'mapId', description: '地图ID' })
  @ApiResponse({ status: 200, description: '成功删除场景图层数据' })
  @Get('delete/:mapid')
  deleteLayer(@Param('mapid') mapid: number) {
    return this.layerService.deleteLayer(mapid);
  }
}
