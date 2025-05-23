import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Action } from '../actions/entities/action.entity';
import { IsUserAlreadyExist } from './validators/user-already-exists.validator';
import { UserAction } from '../actions/entities/user-action.entity';
import { Communique } from '../communiques/entities/communique.entity';
import { UserController } from './user.controller';
import { Friend } from './friend.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    TypeOrmModule.forFeature([Action]),
    TypeOrmModule.forFeature([UserAction]),
    TypeOrmModule.forFeature([Communique]),
    TypeOrmModule.forFeature([Friend]),
  ],
  controllers: [UserController],
  providers: [UserService, IsUserAlreadyExist],
  exports: [UserService],
})
export class UserModule {}
