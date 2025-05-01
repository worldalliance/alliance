import { Test, TestingModule } from '@nestjs/testing';
import { ImagesService } from './images.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Image } from './entities/image.entity';
import { FilesService } from './files.service';

describe('ImagesService', () => {
  let service: ImagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImagesService,
        {
          provide: getRepositoryToken(Image),
          useValue: {},
        },
        FilesService,
      ],
    }).compile();

    service = module.get<ImagesService>(ImagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
