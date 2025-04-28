import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { UnauthorizedException } from '@nestjs/common';
import { Action } from 'src/actions/entities/action.entity';

describe('UsersService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getRepositoryToken(User),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Action),
          useValue: {},
        },
        JwtService,
        UserService,
        AuthService,
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should return unauthorized if user is not found', async () => {
      const result = await service.login(
        'doesntexist@example.com',
        'badpassword',
      );
      expect(result)
        .rejects.toThrow(UnauthorizedException)
        .catch((e) => {
          expect(e).toBeInstanceOf(UnauthorizedException);
        });
    });
  });
});
