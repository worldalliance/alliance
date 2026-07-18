import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActionsModule } from 'src/actions/actions.module';
import { Action } from 'src/actions/entities/action.entity';
import { FollowUpForm } from 'src/actions/entities/follow-up-form.entity';
import { AiDetectionModule } from 'src/ai-detection/ai-detection.module';
import { AuthModule } from 'src/auth/auth.module';
import { Guest } from 'src/auth/entities/guest.entity';
import { ContractModule } from 'src/contract/contract.module';
import { EventLogModule } from 'src/eventlog/eventlog.module';
import { ForumModule } from 'src/forum/forum.module';
import { MmsModule } from 'src/mms/mms.module';
import { ShareUrlsModule } from 'src/share-urls/share-urls.module';
import { User } from 'src/user/entities/user.entity';
import { UserModule } from 'src/user/user.module';
import { CustomValidator } from './entities/customvalidator.entity';
import { Form } from './entities/form.entity';
import { FormResponse } from './entities/formresponse.entity';
import { FormResponseRevision } from './entities/formresponserevision.entity';
import { FormSnapshotModule } from './formsnapshot.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Form,
      FormResponse,
      FormResponseRevision,
      Action,
      CustomValidator,
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
    FormSnapshotModule,
    ShareUrlsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule { }
