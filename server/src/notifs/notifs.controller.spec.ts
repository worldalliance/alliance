import { Test, TestingModule } from '@nestjs/testing';
import { NotifsController } from './notifs.controller';
import { NotifsService } from './notifs.service';

describe('NotifsController', () => {
  let controller: NotifsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotifsController],
      providers: [NotifsService],
    }).compile();

    controller = module.get<NotifsController>(NotifsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
