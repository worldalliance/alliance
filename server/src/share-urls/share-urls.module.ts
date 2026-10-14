import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Community } from "src/community/entities/community.entity";
import { User } from "src/user/entities/user.entity";
import { ExternalShareTarget } from "./entities/external-share-target.entity";
import { InviteMessageTemplate } from "./entities/invite-message-template.entity";
import { ShareUrl } from "./entities/share-url.entity";
import { ExternalShareTargetsController } from "./external-share-targets.controller";
import { ExternalShareTargetsService } from "./external-share-targets.service";
import { InviteLinkAdminController } from "./invite-link-admin.controller";
import { InviteLinkAdminService } from "./invite-link-admin.service";
import { ShareUrlsController } from "./share-urls.controller";
import { ShareUrlsService } from "./share-urls.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShareUrl,
      ExternalShareTarget,
      User,
      Community,
      InviteMessageTemplate,
    ]),
  ],
  controllers: [
    ShareUrlsController,
    ExternalShareTargetsController,
    InviteLinkAdminController,
  ],
  providers: [
    ShareUrlsService,
    ExternalShareTargetsService,
    InviteLinkAdminService,
  ],
  exports: [ShareUrlsService],
})
export class ShareUrlsModule {}
