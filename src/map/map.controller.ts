import { Controller, Get } from '@nestjs/common';
import { MapService } from './map.service';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

@Controller('map')
@ApiTags('地图')
export class MapController {
    constructor(private readonly mapService: MapService) {}

    @ApiOperation({ summary: '获取地图', description: '获取机器人地图数据' })
    @ApiParam({ name: 'mapId', description: '地图ID' })
    @ApiResponse({ status: 200, description: '成功获取地图数据' })
    @Get()
    getMap(){
        return this.mapService.getMap()
    }
}
