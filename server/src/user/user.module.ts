import { Module, OnModuleInit, forwardRef } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CampaignModule } from "src/campaign/campaign.module";
import { CommunityModule } from "src/community/community.module";
import { CommunityInvite } from "src/community/entities/community-invite.entity";
import { Community } from "src/community/entities/community.entity";
import { ALL_MEMBERS_TAG_NAME } from "src/constants";
import { EventLogModule } from "src/eventlog/eventlog.module";
import { ImagesModule } from "src/images/images.module";
import { MailModule } from "src/mail/mail.module";
import { NotifsModule } from "src/notifs/notifs.module";
import { PushModule } from "src/push/push.module";
import { ShareUrlsModule } from "src/share-urls/share-urls.module";
import { ActionActivity } from "../actions/entities/action-activity.entity";
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
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { IsUserAlreadyExist } from "./validators/user-already-exists.validator";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Action,
      ActionActivity,
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
  controllers: [UserController],
  providers: [UserService, IsUserAlreadyExist],
  exports: [UserService],
})
export class UserModule implements OnModuleInit {
  constructor(private readonly userService: UserService) {}

  async onModuleInit() {
    const existing = await this.userService.findAllMembersTag();
    if (!existing) {
      await this.userService.createTag({
        name: ALL_MEMBERS_TAG_NAME,
        description: "Every Alliance member",
      });
    }
  }
}
