import { Test, TestingModule } from '@nestjs/testing';
import { ActionsController } from './actions.controller';
import { ActionsService } from './actions.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { Action } from './entities/action.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { UserAction } from './entities/user-action.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Friend } from '../user/friend.entity';
describe('ActionsController', () => {
  let controller: ActionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActionsController],
      providers: [
        ActionsService,
        UserService,
        EventEmitter2,
        JwtService,
        {
          provide: getRepositoryToken(Action),
          useValue: {},
        },
        {
          provide: getRepositoryToken(UserAction),
          useValue: {},
        },
        {
          provide: getRepositoryToken(User),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Friend),
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<ActionsController>(ActionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
