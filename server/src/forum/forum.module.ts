import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Action } from "src/actions/entities/action.entity";
import { AiDetectionModule } from "src/ai-detection/ai-detection.module";
import { EventLogModule } from "src/eventlog/eventlog.module";
import { FacepileModule } from "src/likes/facepile.module";
import { MailModule } from "src/mail/mail.module";
import { MmsModule } from "src/mms/mms.module";
import { NotifsModule } from "src/notifs/notifs.module";
import { UserModule } from "src/user/user.module";
import { ActionActivity } from "../actions/entities/action-activity.entity";
import { Notification } from "../notifs/entities/notification.entity";
import { User } from "../user/entities/user.entity";
import { Comment } from "./entities/comment.entity";
import { EditableContent } from "./entities/editablecontent.entity";
import { ForumDigestLog } from "./entities/forum-digest-log.entity";
import { Post } from "./entities/post.entity";
import { ForumDigestService } from "./forum-digest.service";
import { ForumController } from "./forum.controller";
import { ForumService } from "./forum.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Post,
      Comment,
      Notification,
      User,
      ActionActivity,
      EditableContent,
      Action,
      ForumDigestLog,
    ]),
    MailModule,
    MmsModule,
    forwardRef(() => NotifsModule),
    forwardRef(() => EventLogModule),
    forwardRef(() => UserModule),
    AiDetectionModule,
    FacepileModule,
  ],
  controllers: [ForumController],
  providers: [ForumService, ForumDigestService],
  exports: [ForumService],
})
export class ForumModule {}
