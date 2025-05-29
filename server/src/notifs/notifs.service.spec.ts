import { Test, TestingModule } from '@nestjs/testing';
import { NotifsService } from './notifs.service';

describe('NotifsService', () => {
  let service: NotifsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotifsService],
    }).compile();

    service = module.get<NotifsService>(NotifsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
