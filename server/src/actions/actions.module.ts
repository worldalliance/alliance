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
import { Group } from '../user/entities/group.entity';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Action,
      ActionEvent,
      ActionActivity,
      Comment,
      EditableContent,
      Group,
      ActionUpdate,
      ReminderGroup,
      ActionEventNotif,
      ActionSuite,
    ]),
    UserModule,
    NotifsModule,
    MailModule,
    MmsModule,
  ],
  controllers: [ActionsController],
  providers: [
    ActionsService,
    ActionsGateway,
    ActionEventNotifWorker,
    ActionEventRecipientService,
    ActionEventReminderService,
  ],
  exports: [ActionsService],
})
export class ActionsModule {}
