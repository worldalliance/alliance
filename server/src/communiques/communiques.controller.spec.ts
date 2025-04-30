import { Test, TestingModule } from '@nestjs/testing';
import { CommuniquesController } from './communiques.controller';
import { CommuniquesService } from './communiques.service';

describe('CommuniquesController', () => {
  let controller: CommuniquesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommuniquesController],
      providers: [CommuniquesService],
    }).compile();

    controller = module.get<CommuniquesController>(CommuniquesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
