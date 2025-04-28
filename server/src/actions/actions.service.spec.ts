import { Test, TestingModule } from '@nestjs/testing';
import { ActionsService } from './actions.service';
import { Action } from './entities/action.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { UserAction } from './entities/user-action.entity';

describe('ActionsService', () => {
  let service: ActionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionsService,
        UserService,
        {
          provide: getRepositoryToken(Action),
          useValue: {},
        },
        {
          provide: getRepositoryToken(User),
          useValue: {},
        },
        {
          provide: getRepositoryToken(UserAction),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ActionsService>(ActionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
