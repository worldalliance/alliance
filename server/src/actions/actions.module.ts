import { Module } from '@nestjs/common';
import { ActionsService } from './actions.service';
import { ActionsController } from './actions.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Action } from './entities/action.entity';
import { UserModule } from '../user/user.module';
import { User } from '../user/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    TypeOrmModule.forFeature([Action]),
    UserModule,
  ],
  controllers: [ActionsController],
  providers: [ActionsService],
})
export class ActionsModule {}
