import { Test, TestingModule } from '@nestjs/testing';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';

describe('ForumController', () => {
  let controller: ForumController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ForumController],
      providers: [ForumService],
    }).compile();

    controller = module.get<ForumController>(ForumController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
