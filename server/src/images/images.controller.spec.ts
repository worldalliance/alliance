import { Test, TestingModule } from '@nestjs/testing';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Image } from './entities/image.entity';
import { FilesService } from './files.service';

describe('ImagesController', () => {
  let controller: ImagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImagesController],
      providers: [
        FilesService,
        ImagesService,
        {
          provide: getRepositoryToken(Image),
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<ImagesController>(ImagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
