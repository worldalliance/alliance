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
import { NotificationSettingsModule } from "src/notification-settings/notification-settings.module";
import { ActionEventNotifDeliveryService } from "src/notifs/action-event-notif-delivery.service";
import { ActionEventNotifWorker } from "src/notifs/action-event-notif.worker";
import { ActionEventRecipientService } from "src/notifs/action-event-recipient.service";
import { ActionEventReminderService } from "src/notifs/action-event-reminder.service";
import { ActionEventNotif } from "src/notifs/entities/action-event-notif.entity";
import { ExperimentAssignment } from "src/notifs/entities/experiment-assignment.entity";
import { Notification } from "src/notifs/entities/notification.entity";
import { MissedSuitePlanService } from "src/notifs/missed-suite-plans.service";
import { NotifsModule } from "src/notifs/notifs.module";
import { ReminderGroupService } from "src/notifs/reminder-group.service";
import { ReminderPreviewService } from "src/notifs/reminder-preview.service";
import { PushModule } from "src/push/push.module";
import { ShareUrlsModule } from "src/share-urls/share-urls.module";
import { CustomValidator } from "src/tasks/entities/customvalidator.entity";
import { Form } from "src/tasks/entities/form.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { FormSnapshotModule } from "src/tasks/formsnapshot.module";
import { OnetimeInvite } from "src/user/entities/onetime-invite.entity";
import { UserDevice } from "src/user/entities/user-device.entity";
import { ContractEvent } from "../user/entities/contract-event.entity";
import { Tag } from "../user/entities/tag.entity";
import { User } from "../user/entities/user.entity";
import { UserModule } from "../user/user.module";
import { ActionActivityService } from "./action-activity.service";
import { ActionFeedController } from "./action-feed.controller";
import { ActionFormVariantService } from "./action-form-variant.service";
import { ActionFormsController } from "./action-forms.controller";
import { ActionImportExportService } from "./action-import-export.service";
import { ActionParticipantsService } from "./action-participants.service";
import { ActionRelationsService } from "./action-relations.service";
import { ActionRemindersController } from "./action-reminders.controller";
import { ActionShareService } from "./action-share.service";
import { ActionStatsService } from "./action-stats.service";
import { ActionSuitesController } from "./action-suites.controller";
import { ActionSuitesService } from "./action-suites.service";
import { ActionSuspensionService } from "./action-suspension.service";
import { ActionUpdateNotifyService } from "./action-update-notify.service";
import { ActionUpdateRecognitionPreviewService } from "./action-update-recognition-preview.service";
import { ActionUpdateRecognitionService } from "./action-update-recognition.service";
import { ActionUpdateRecognitionWorker } from "./action-update-recognition.worker";
import { ActionUpdatesController } from "./action-updates.controller";
import { ActionUpdatesService } from "./action-updates.service";
import { ActionVisibilityModule } from "./action-visibility.module";
import { ActionsController } from "./actions.controller";
import { ActionsGateway } from "./actions.gateway";
import { ActionsService } from "./actions.service";
import { ActivityFeedService } from "./activity-feed.service";
import { ActivityLikeService } from "./activity-like.service";
import { ActivityOutputService } from "./activity-output.service";
import { CohortDecisionStaffService } from "./cohort-decision-staff.service";
import { CohortDecisionListener } from "./cohort-decision.listener";
import { CohortDecisionService } from "./cohort-decision.service";
import { CohortDecisionWorker } from "./cohort-decision.worker";
import { CohortDecisionsController } from "./cohort-decisions.controller";
import { CohortDivergenceService } from "./cohort-divergence.service";
import { CohortResolverService } from "./cohort-resolver.service";
import { ContractReinstatedListener } from "./contract-reinstated.listener";
import { ContractReminderWorker } from "./contract-reminder.worker";
import { ContractSuspenderWorker } from "./contract-suspender.worker";
import { ActionActivity } from "./entities/action-activity.entity";
import { ActionCohortDecisionCorrection } from "./entities/action-cohort-decision-correction.entity";
import { ActionCohortDecision } from "./entities/action-cohort-decision.entity";
import { ActionEvent } from "./entities/action-event.entity";
import { ActionFormAssignment } from "./entities/action-form-assignment.entity";
import { ActionFormVariant } from "./entities/action-form-variant.entity";
import { ActionReviewer } from "./entities/action-reviewer.entity";
import { ActionSuite } from "./entities/action-suite.entity";
import { ActionUpdateExposure } from "./entities/action-update-exposure.entity";
import { ActionUpdate } from "./entities/action-update.entity";
import { Action } from "./entities/action.entity";
import { FollowUpForm } from "./entities/follow-up-form.entity";
import { GeneralUpdateActivity } from "./entities/general-update-activity.entity";
import { GeneralUpdate } from "./entities/general-update.entity";
import { Project } from "./entities/project.entity";
import { ReminderGroup } from "./entities/reminder-group.entity";
import { FeedMembersService } from "./feed-members.service";
import { FollowUpFormsService } from "./follow-up-forms.service";
import { ForumActionCompleterWorker } from "./forum-action-completer.worker";
import { GeneralUpdatesController } from "./general-updates.controller";
import { GeneralUpdatesService } from "./general-updates.service";
import { GlobalFeedService } from "./global-feed.service";
import { HomeFeedService } from "./home-feed.service";
import { MemberActionsService } from "./member-actions.service";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { ReloadUsersJoinedWorker } from "./reload-users-joined.worker";
import { SchemaWriteService } from "./schema-write.service";
import { TaskBadgeService } from "./task-badge.service";
import { WelcomeQueueService } from "./welcome-queue.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Action,
      ActionActivity,
      ActionCohortDecision,
      ActionCohortDecisionCorrection,
      ActionEvent,
      ActionEventNotif,
      ActionFormAssignment,
      ActionFormVariant,
      ActionReviewer,
      ActionSuite,
      ActionUpdate,
      ActionUpdateExposure,
      Comment,
      ContractEvent,
      CustomValidator,
      EditableContent,
      ExperimentAssignment,
      Form,
      FormResponse,
      FollowUpForm,
      GeneralUpdate,
      GeneralUpdateActivity,
      Notification,
      OnetimeInvite,
      Post,
      Project,
      ReminderGroup,
      Tag,
      Community,
      UserDevice,
    ]),
    ContractModule,
    UserModule,
    CommunityModule,
    NotifsModule,
    NotificationSettingsModule,
    ActionVisibilityModule,
    MailModule,
    MmsModule,
    PushModule,
    ForumModule,
    FacepileModule,
    EventLogModule,
    FormSnapshotModule,
    forwardRef(() => ShareUrlsModule),
  ],
  controllers: [
    ActionsController,
    GeneralUpdatesController,
    ActionUpdatesController,
    ActionRemindersController,
    ActionSuitesController,
    ActionFeedController,
    ActionFormsController,
    CohortDecisionsController,
    ProjectsController,
  ],
  providers: [
    ActionsService,
    ProjectsService,
    ActionFormVariantService,
    ActionsGateway,
    ActionEventNotifWorker,
    ActionEventNotifDeliveryService,
    ActionParticipantsService,
    ActionUpdateRecognitionService,
    ActionUpdateRecognitionPreviewService,
    ActionUpdateRecognitionWorker,
    ActionEventRecipientService,
    ActionEventReminderService,
    ReminderGroupService,
    ReminderPreviewService,
    MissedSuitePlanService,
    ReloadUsersJoinedWorker,
    ContractReminderWorker,
    ContractSuspenderWorker,
    ContractReinstatedListener,
    ForumActionCompleterWorker,
    ActionStatsService,
    CohortDecisionListener,
    CohortDecisionService,
    CohortDecisionStaffService,
    CohortDecisionWorker,
    TaskBadgeService,
    CohortDivergenceService,
    CohortResolverService,
    FeedMembersService,
    GlobalFeedService,
    ActivityOutputService,
    ActivityFeedService,
    HomeFeedService,
    ActivityLikeService,
    ActionSuspensionService,
    ActionShareService,
    SchemaWriteService,
    GeneralUpdatesService,
    ActionUpdatesService,
    ActionUpdateNotifyService,
    ActionSuitesService,
    FollowUpFormsService,
    ActionRelationsService,
    ActionImportExportService,
    WelcomeQueueService,
    ActionActivityService,
    MemberActionsService,
  ],
  exports: [
    ActionsService,
    ActionActivityService,
    ActionVisibilityModule,
    ActionFormVariantService,
    ActionEventRecipientService,
    CohortResolverService,
  ],
})
export class ActionsModule {}
