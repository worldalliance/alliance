import { Test, TestingModule } from '@nestjs/testing';
import { CommuniquesController } from './communiques.controller';
import { CommuniquesService } from './communiques.service';
import { Communique } from './entities/communique.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('CommuniquesController', () => {
  let controller: CommuniquesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommuniquesController],
      providers: [
        CommuniquesService,
        {
          provide: getRepositoryToken(Communique),
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<CommuniquesController>(CommuniquesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
