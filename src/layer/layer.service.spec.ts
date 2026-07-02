import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LayerEntity } from 'src/entity/layerEntity';
import { LayerService } from './layer.service';
import { RedisService } from 'src/common/redis.service';
import { REDIS_CLIENT } from 'src/common/redis.constants';

describe('LayerService', () => {
  let service: LayerService;
  let module: TestingModule;
  const layerRepository = {
    findOneBy: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const redisService = {
    getJson: jest.fn(),
    setJson: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        LayerService,
        {
          provide: getRepositoryToken(LayerEntity),
          useValue: layerRepository,
        },
        {
          provide: REDIS_CLIENT,
          useValue: {},
        },
        {
          provide: RedisService,
          useValue: redisService,
        },
      ],
    }).compile();

    service = module.get<LayerService>(LayerService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
