import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Action } from "src/actions/entities/action.entity";
import { AiDetectionModule } from "src/ai-detection/ai-detection.module";
import { EventLogModule } from "src/eventlog/eventlog.module";
import { FacepileModule } from "src/likes/facepile.module";
import { MailModule } from "src/mail/mail.module";
import { MmsModule } from "src/mms/mms.module";
import { NotifsModule } from "src/notifs/notifs.module";
import { S3Module } from "src/s3/s3.module";
import { UserModule } from "src/user/user.module";
import { ActionActivity } from "../actions/entities/action-activity.entity";
import { User } from "../user/entities/user.entity";
import { Comment } from "./entities/comment.entity";
import { EditableContent } from "./entities/editablecontent.entity";
import { PostTag } from "./entities/post-tag.entity";
import { Post } from "./entities/post.entity";
import { ForumAdminService } from "./forum-admin.service";
import { ForumCommentQueryService } from "./forum-comment-query.service";
import { ForumCommentService } from "./forum-comment.service";
import { ForumExportService } from "./forum-export.service";
import { ForumLikesService } from "./forum-likes.service";
import { ForumController } from "./forum.controller";
import { ForumService } from "./forum.service";
import { LegacyDeletedFlagService } from "./legacy-deleted-flag.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Post,
      Comment,
      User,
      ActionActivity,
      EditableContent,
      Action,
      PostTag,
    ]),
    MailModule,
    MmsModule,
    forwardRef(() => NotifsModule),
    forwardRef(() => EventLogModule),
    forwardRef(() => UserModule),
    AiDetectionModule,
    FacepileModule,
    S3Module,
  ],
  controllers: [ForumController],
  providers: [
    ForumService,
    ForumAdminService,
    ForumCommentService,
    ForumCommentQueryService,
    ForumExportService,
    ForumLikesService,
    LegacyDeletedFlagService,
  ],
  exports: [ForumService, ForumCommentQueryService],
})
export class ForumModule {}
