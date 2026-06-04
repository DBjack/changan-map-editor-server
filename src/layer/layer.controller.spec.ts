import { Test, TestingModule } from '@nestjs/testing';
import { LayerController } from './layer.controller';

describe('LayerController', () => {
  let controller: LayerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LayerController],
    }).compile();

    controller = module.get<LayerController>(LayerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
