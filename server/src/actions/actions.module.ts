import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from 'src/forum/entities/comment.entity';
import { EditableContent } from 'src/forum/entities/editablecontent.entity';
import { MailModule } from 'src/mail/mail.module';
import { MmsModule } from 'src/mms/mms.module';
import { ActionEventNotifWorker } from 'src/notifs/action-event-notif.worker';
import { ActionEventRecipientService } from 'src/notifs/action-event-recipient.service';
import { ActionEventReminderService } from 'src/notifs/action-event-reminder.service';
import { ActionEventNotif } from 'src/notifs/entities/action-event-notif.entity';
import { NotifsModule } from 'src/notifs/notifs.module';
import { User } from '../user/entities/user.entity';
import { Tag } from '../user/entities/tag.entity';
import { UserModule } from '../user/user.module';
import { ActionsController } from './actions.controller';
import { ActionsGateway } from './actions.gateway';
import { ActionsService } from './actions.service';
import { ActionActivity } from './entities/action-activity.entity';
import { ActionEvent } from './entities/action-event.entity';
import { Action } from './entities/action.entity';
import { ActionUpdate } from './entities/action-update.entity';
import { ReminderGroup } from './entities/reminder-group.entity';
import { ActionSuite } from './entities/action-suite.entity';
import { ForumModule } from 'src/forum/forum.module';
import { Form } from 'src/tasks/entities/form.entity';
import { ReloadUsersJoinedWorker } from './reload-users-joined.worker';
import { ContractSuspenderWorker } from './contract-suspender.worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Action,
      ActionEvent,
      ActionActivity,
      Comment,
      EditableContent,
      Tag,
      ActionUpdate,
      ReminderGroup,
      ActionEventNotif,
      ActionSuite,
      Form,
    ]),
    UserModule,
    NotifsModule,
    MailModule,
    MmsModule,
    ForumModule,
  ],
  controllers: [ActionsController],
  providers: [
    ActionsService,
    ActionsGateway,
    ActionEventNotifWorker,
    ActionEventRecipientService,
    ActionEventReminderService,
    ReloadUsersJoinedWorker,
    ContractSuspenderWorker,
  ],
  exports: [ActionsService],
})
export class ActionsModule {}
