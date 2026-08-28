import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CommunityModule } from "src/community/community.module";
import { Community } from "src/community/entities/community.entity";
import { ContractModule } from "src/contract/contract.module";
import { EventLogModule } from "src/eventlog/eventlog.module";
import { Comment } from "src/forum/entities/comment.entity";
import { EditableContent } from "src/forum/entities/editablecontent.entity";
import { Post } from "src/forum/entities/post.entity";
import { ForumModule } from "src/forum/forum.module";
import { FacepileModule } from "src/likes/facepile.module";
import { MailModule } from "src/mail/mail.module";
import { MmsModule } from "src/mms/mms.module";
import { ActionEventNotifWorker } from "src/notifs/action-event-notif.worker";
import { ActionEventRecipientService } from "src/notifs/action-event-recipient.service";
import { ActionEventReminderService } from "src/notifs/action-event-reminder.service";
import { ActionEventNotif } from "src/notifs/entities/action-event-notif.entity";
import { NotifsModule } from "src/notifs/notifs.module";
import { PushModule } from "src/push/push.module";
import { ShareUrlsModule } from "src/share-urls/share-urls.module";
import { CustomValidator } from "src/tasks/entities/customvalidator.entity";
import { Form } from "src/tasks/entities/form.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { FormSnapshotModule } from "src/tasks/formsnapshot.module";
import { OnetimeInvite } from "src/user/entities/onetime-invite.entity";
import { ContractEvent } from "../user/entities/contract-event.entity";
import { Tag } from "../user/entities/tag.entity";
import { User } from "../user/entities/user.entity";
import { UserModule } from "../user/user.module";
import { ActionFormVariantService } from "./action-form-variant.service";
import { ActionStatsService } from "./action-stats.service";
import { ActionsController } from "./actions.controller";
import { ActionsGateway } from "./actions.gateway";
import { ActionsService } from "./actions.service";
import { ContractReminderWorker } from "./contract-reminder.worker";
import { ContractSuspenderWorker } from "./contract-suspender.worker";
import { ActionActivity } from "./entities/action-activity.entity";
import { ActionEvent } from "./entities/action-event.entity";
import { ActionFormAssignment } from "./entities/action-form-assignment.entity";
import { ActionFormVariant } from "./entities/action-form-variant.entity";
import { ActionReviewer } from "./entities/action-reviewer.entity";
import { ActionSuite } from "./entities/action-suite.entity";
import { ActionUpdate } from "./entities/action-update.entity";
import { Action } from "./entities/action.entity";
import { FollowUpForm } from "./entities/follow-up-form.entity";
import { GeneralUpdateActivity } from "./entities/general-update-activity.entity";
import { GeneralUpdate } from "./entities/general-update.entity";
import { ReminderGroup } from "./entities/reminder-group.entity";
import { ForumActionCompleterWorker } from "./forum-action-completer.worker";
import { ReloadUsersJoinedWorker } from "./reload-users-joined.worker";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Action,
      ActionActivity,
      ActionEvent,
      ActionEventNotif,
      ActionFormAssignment,
      ActionFormVariant,
      ActionReviewer,
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
      Community,
    ]),
    ContractModule,
    UserModule,
    CommunityModule,
    NotifsModule,
    MailModule,
    MmsModule,
    PushModule,
    ForumModule,
    FacepileModule,
    EventLogModule,
    FormSnapshotModule,
    forwardRef(() => ShareUrlsModule),
  ],
  controllers: [ActionsController],
  providers: [
    ActionsService,
    ActionFormVariantService,
    ActionsGateway,
    ActionEventNotifWorker,
    ActionEventRecipientService,
    ActionEventReminderService,
    ReloadUsersJoinedWorker,
    ContractReminderWorker,
    ContractSuspenderWorker,
    ForumActionCompleterWorker,
    ActionStatsService,
  ],
  exports: [
    ActionsService,
    ActionFormVariantService,
    ActionEventRecipientService,
  ],
})
export class ActionsModule {}
