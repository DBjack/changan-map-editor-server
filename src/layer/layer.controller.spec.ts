import { Test, TestingModule } from '@nestjs/testing';
import { LayerController } from './layer.controller';
import { LayerService } from './layer.service';

describe('LayerController', () => {
  let controller: LayerController;
  let module: TestingModule;
  const layerService = {
    getLayer: jest.fn(),
    updateLayer: jest.fn(),
    deleteLayer: jest.fn(),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [LayerController],
      providers: [
        {
          provide: LayerService,
          useValue: layerService,
        },
      ],
    }).compile();

    controller = module.get<LayerController>(LayerController);
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
