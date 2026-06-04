import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LayerService } from './layer.service';
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
@ApiTags('图层')
export class LayerController {
  constructor(private readonly layerService: LayerService) {}

  @ApiOperation({ summary: '获取图层列表', description: '获取图层数据' })
  @ApiParam({ name: 'id', description: '图层ID' })
  @ApiResponse({ status: 200, description: '成功获取图层数据' })
  @Get('list/:id')
  getLayer(@Param('id') id: string) {
    return this.layerService.getLayer(id);
  }

  @ApiOperation({ summary: '更新图层', description: '更新图层数据' })
  @ApiBody({ type: UpdateLayerDto })
  @ApiResponse({ status: 200, description: '成功更新图层数据' })
  @Post('update')
  updateLayer(@Body() layer: UpdateLayerDto): AppResponse {
    return this.layerService.updateLayer(layer);
  }

  @ApiOperation({ summary: '删除图层', description: '删除图层数据' })
  @ApiParam({ name: 'id', description: '图层ID' })
  @ApiResponse({ status: 200, description: '成功删除图层数据' })
  @Get('delete/:id')
  deleteLayer(@Param('id') id: string) {
    return this.layerService.deleteLayer(id);
  }
}
