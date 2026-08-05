import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiDetectionModule } from 'src/ai-detection/ai-detection.module';
import { FacepileModule } from 'src/likes/facepile.module';
import { ForumService } from './forum.service';
import { ForumController } from './forum.controller';
import { Post } from './entities/post.entity';
import { Comment } from './entities/comment.entity';
import { Notification } from '../notifs/entities/notification.entity';
import { User } from '../user/entities/user.entity';
import { ActionActivity } from '../actions/entities/action-activity.entity';
import { EditableContent } from './entities/editablecontent.entity';
import { Action } from 'src/actions/entities/action.entity';
import { MailModule } from 'src/mail/mail.module';
import { NotifsModule } from 'src/notifs/notifs.module';
import { ForumDigestService } from './forum-digest.service';
import { ForumDigestLog } from './entities/forum-digest-log.entity';
import { EventLogModule } from 'src/eventlog/eventlog.module';
import { UserModule } from 'src/user/user.module';
import { MmsModule } from 'src/mms/mms.module';

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
