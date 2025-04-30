import { Test, TestingModule } from '@nestjs/testing';
import { CommuniquesService } from './communiques.service';

describe('CommuniquesService', () => {
  let service: CommuniquesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommuniquesService],
    }).compile();

    service = module.get<CommuniquesService>(CommuniquesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
