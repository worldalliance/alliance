import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiDetectionModule } from 'src/ai-detection/ai-detection.module';
import { Action } from 'src/actions/entities/action.entity';
import { FollowUpForm } from 'src/actions/entities/follow-up-form.entity';
import { UserModule } from 'src/user/user.module';
import { Form } from './entities/form.entity';
import { FormResponse } from './entities/formresponse.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { ForumModule } from 'src/forum/forum.module';
import { ActionsModule } from 'src/actions/actions.module';
import { MmsModule } from 'src/mms/mms.module';
import { CustomValidator } from './entities/customvalidator.entity';
import { ActionShareUrl } from 'src/actions/entities/action-share-url.entity';
import { EventLogModule } from 'src/eventlog/eventlog.module';
import { User } from 'src/user/entities/user.entity';
import { ContractModule } from 'src/contract/contract.module';
import { AuthModule } from 'src/auth/auth.module';
import { Guest } from 'src/auth/entities/guest.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Form,
      FormResponse,
      Action,
      CustomValidator,
      ActionShareUrl,
      User,
      FollowUpForm,
      Guest,
    ]),
    UserModule,
    ForumModule,
    ActionsModule,
    MmsModule,
    EventLogModule,
    AiDetectionModule,
    ContractModule,
    AuthModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
