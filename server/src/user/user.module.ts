import { Module, forwardRef } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ActionVisibilityModule } from "src/actions/action-visibility.module";
import { CampaignModule } from "src/campaign/campaign.module";
import { CommunityModule } from "src/community/community.module";
import { CommunityInvite } from "src/community/entities/community-invite.entity";
import { Community } from "src/community/entities/community.entity";
import { EventLogModule } from "src/eventlog/eventlog.module";
import { ImagesModule } from "src/images/images.module";
import { MailModule } from "src/mail/mail.module";
import { NotifsModule } from "src/notifs/notifs.module";
import { PushModule } from "src/push/push.module";
import { ShareUrlsModule } from "src/share-urls/share-urls.module";
import { Action } from "../actions/entities/action.entity";
import { City } from "../geo/city.entity";
import { Notification } from "../notifs/entities/notification.entity";
import { AmbassadorInviteGoal } from "./entities/ambassador-invite-goal.entity";
import { AmbassadorProgramInteraction } from "./entities/ambassador-program-interaction.entity";
import { AmbassadorProgramMember } from "./entities/ambassador-program-member.entity";
import { ContractEvent } from "./entities/contract-event.entity";
import { Friend } from "./entities/friend.entity";
import { OnetimeInvite } from "./entities/onetime-invite.entity";
import { Tag } from "./entities/tag.entity";
import { UserAwayRange } from "./entities/user-away-range.entity";
import { UserDevice } from "./entities/user-device.entity";
import { User } from "./entities/user.entity";
import { FriendService } from "./friend.service";
import { GroupAssignmentService } from "./group-assignment.service";
import { ReferralService } from "./referral.service";
import { TagService } from "./tag.service";
import { UserAwayRangeController } from "./user-away-range.controller";
import { UserAwayRangeService } from "./user-away-range.service";
import { UserDeviceController } from "./user-device.controller";
import { UserDeviceService } from "./user-device.service";
import { UserFriendController } from "./user-friend.controller";
import { UserGroupAssignmentController } from "./user-group-assignment.controller";
import { UserReferralController } from "./user-referral.controller";
import { UserTagController } from "./user-tag.controller";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { IsUserAlreadyExist } from "./validators/user-already-exists.validator";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Action,
      City,
      Community,
      CommunityInvite,
      ContractEvent,
      AmbassadorInviteGoal,
      AmbassadorProgramInteraction,
      AmbassadorProgramMember,
      Friend,
      Notification,
      OnetimeInvite,
      Tag,
      UserDevice,
      UserAwayRange,
    ]),
    ActionVisibilityModule,
    JwtModule,
    ImagesModule,
    MailModule,
    ShareUrlsModule,
    CampaignModule,
    forwardRef(() => PushModule),
    forwardRef(() => EventLogModule),
    forwardRef(() => NotifsModule),
    forwardRef(() => CommunityModule),
  ],
  controllers: [
    UserController,
    UserTagController,
    UserAwayRangeController,
    UserDeviceController,
    UserGroupAssignmentController,
    UserReferralController,
    UserFriendController,
  ],
  providers: [
    UserService,
    TagService,
    UserAwayRangeService,
    UserDeviceService,
    GroupAssignmentService,
    ReferralService,
    FriendService,
    IsUserAlreadyExist,
  ],
  exports: [
    UserService,
    TagService,
    UserAwayRangeService,
    ReferralService,
    FriendService,
  ],
})
export class UserModule {}
