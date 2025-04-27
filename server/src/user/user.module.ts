import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Action } from '../actions/entities/action.entity';
import { IsUserAlreadyExist } from './validators/user-already-exists.validator';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    TypeOrmModule.forFeature([Action]),
  ],
  providers: [UserService, IsUserAlreadyExist],
  exports: [UserService],
})
export class UserModule {}
