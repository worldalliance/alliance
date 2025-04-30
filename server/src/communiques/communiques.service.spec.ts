import { Test, TestingModule } from '@nestjs/testing';
import { CommuniquesService } from './communiques.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Communique } from './entities/communique.entity';

describe('CommuniquesService', () => {
  let service: CommuniquesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommuniquesService,
        {
          provide: getRepositoryToken(Communique),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<CommuniquesService>(CommuniquesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
