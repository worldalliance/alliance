import { Module } from '@nestjs/common';
import { ActionsService } from './actions.service';
import { ActionsController } from './actions.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Action } from './entities/action.entity';
import { UserModule } from '../user/user.module';
import { User } from '../user/user.entity';
import { UserAction } from './entities/user-action.entity';
import { ActionUpdate } from './entities/action-update.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    TypeOrmModule.forFeature([Action]),
    TypeOrmModule.forFeature([UserAction]),
    TypeOrmModule.forFeature([ActionUpdate]),
    UserModule,
  ],
  controllers: [ActionsController],
  providers: [ActionsService],
})
export class ActionsModule {}
