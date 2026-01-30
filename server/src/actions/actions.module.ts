import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from 'src/forum/entities/comment.entity';
import { EditableContent } from 'src/forum/entities/editablecontent.entity';
import { Post } from 'src/forum/entities/post.entity';
import { MailModule } from 'src/mail/mail.module';
import { MmsModule } from 'src/mms/mms.module';
import { ActionEventNotifWorker } from 'src/notifs/action-event-notif.worker';
import { ActionEventRecipientService } from 'src/notifs/action-event-recipient.service';
import { ActionEventReminderService } from 'src/notifs/action-event-reminder.service';
import { ActionEventNotif } from 'src/notifs/entities/action-event-notif.entity';
import { NotifsModule } from 'src/notifs/notifs.module';
import { Form } from 'src/tasks/entities/form.entity';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import { ContractEvent } from '../user/entities/contract-event.entity';
import { Tag } from '../user/entities/tag.entity';
import { User } from '../user/entities/user.entity';
import { UserModule } from '../user/user.module';
import { ActionsController } from './actions.controller';
import { ActionsGateway } from './actions.gateway';
import { ActionsService } from './actions.service';
import { ContractSuspenderWorker } from './contract-suspender.worker';
import { ActionActivity } from './entities/action-activity.entity';
import { ActionEvent } from './entities/action-event.entity';
import { ActionShareUrl } from './entities/action-share-url.entity';
import { ActionSuite } from './entities/action-suite.entity';
import { ActionUpdate } from './entities/action-update.entity';
import { Action } from './entities/action.entity';
import { ReminderGroup } from './entities/reminder-group.entity';
import { ForumModule } from 'src/forum/forum.module';
import { ReloadUsersJoinedWorker } from './reload-users-joined.worker';
import { PushModule } from 'src/push/push.module';
import { SlackModule } from 'src/slack/slack.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Action,
      ActionEvent,
      ActionActivity,
      Comment,
      EditableContent,
      Post,
      Tag,
      ActionUpdate,
      ReminderGroup,
      ActionEventNotif,
      ActionSuite,
      Form,
      FormResponse,
      ActionShareUrl,
      ContractEvent,
    ]),
    UserModule,
    NotifsModule,
    MailModule,
    MmsModule,
    PushModule,
    ForumModule,
    SlackModule,
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
  exports: [ActionsService, ActionEventRecipientService],
})
export class ActionsModule {}
