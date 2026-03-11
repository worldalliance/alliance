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
import { CustomValidator } from 'src/tasks/entities/customvalidator.entity';
import { Form } from 'src/tasks/entities/form.entity';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import { ContractEvent } from '../user/entities/contract-event.entity';
import { Tag } from '../user/entities/tag.entity';
import { User } from '../user/entities/user.entity';
import { ContractModule } from 'src/contract/contract.module';
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
import { FollowUpForm } from './entities/follow-up-form.entity';
import { ForumActionCompleterWorker } from './forum-action-completer.worker';
import { ReminderGroup } from './entities/reminder-group.entity';
import { ForumModule } from 'src/forum/forum.module';
import { ReloadUsersJoinedWorker } from './reload-users-joined.worker';
import { PushModule } from 'src/push/push.module';
import { EventLogModule } from 'src/eventlog/eventlog.module';
import { ActionStatsService } from './action-stats.service';
import { OnetimeInvite } from 'src/user/entities/onetime-invite.entity';
import { CommunityModule } from 'src/community/community.module';
import { GeneralUpdate } from './entities/general-update.entity';
import { GeneralUpdateActivity } from './entities/general-update-activity.entity';
import { forwardRef } from '@nestjs/common';
import { ApnsModule } from 'src/apns/apns.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Action,
      ActionActivity,
      ActionEvent,
      ActionEventNotif,
      ActionShareUrl,
      ActionSuite,
      ActionUpdate,
      Comment,
      ContractEvent,
      CustomValidator,
      EditableContent,
      Form,
      FormResponse,
      FollowUpForm,
      GeneralUpdate,
      GeneralUpdateActivity,
      OnetimeInvite,
      Post,
      ReminderGroup,
      Tag,
    ]),
    ContractModule,
    UserModule,
    CommunityModule,
    NotifsModule,
    MailModule,
    MmsModule,
    PushModule,
    ForumModule,
    EventLogModule,
    forwardRef(() => ApnsModule),
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
    ForumActionCompleterWorker,
    ActionStatsService,
  ],
  exports: [ActionsService, ActionEventRecipientService],
})
export class ActionsModule { }
