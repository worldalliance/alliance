import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import { ActionUpdate } from "src/actions/entities/action-update.entity";
import { Action } from "src/actions/entities/action.entity";
import { Community } from "src/community/entities/community.entity";
import { Comment } from "src/forum/entities/comment.entity";
import { MailModule } from "src/mail/mail.module";
import { MmsModule } from "src/mms/mms.module";
import { User } from "src/user/entities/user.entity";
import { UserModule } from "src/user/user.module";
import { ActionEventNotif } from "./entities/action-event-notif.entity";
import { Notification } from "./entities/notification.entity";
import { UnreadContent } from "./entities/unread-content.entity";
import { LikeNotificationService } from "./like-notification.service";
import { NotificationReferencesService } from "./notification-references.service";
import { NotificationRenderService } from "./notification-render.service";
import { NotifsController } from "./notifs.controller";
import { NotifsService } from "./notifs.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      UnreadContent,
      ActionEventNotif,
      ActionUpdate,
      ActionActivity,
      Comment,
      User,
      Community,
      Action,
    ]),
    MailModule,
    forwardRef(() => MmsModule),
    forwardRef(() => UserModule),
  ],
  controllers: [NotifsController],
  providers: [
    NotifsService,
    LikeNotificationService,
    NotificationReferencesService,
    NotificationRenderService,
  ],
  exports: [NotifsService, LikeNotificationService],
})
export class NotifsModule {}
