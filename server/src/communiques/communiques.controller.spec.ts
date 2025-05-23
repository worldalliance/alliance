import { Test, TestingModule } from '@nestjs/testing';
import { CommuniquesController } from './communiques.controller';
import { CommuniquesService } from './communiques.service';
import { Communique } from './entities/communique.entity';
import { User } from '../user/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { Friend } from '../user/friend.entity';

describe('CommuniquesController', () => {
  let controller: CommuniquesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommuniquesController],
      providers: [
        UserService,
        CommuniquesService,
        JwtService,
        {
          provide: getRepositoryToken(Communique),
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

    controller = module.get<CommuniquesController>(CommuniquesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
