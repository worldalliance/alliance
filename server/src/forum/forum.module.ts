import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ForumService } from './forum.service';
import { ForumController } from './forum.controller';
import { Post } from './entities/post.entity';
import { Reply } from './entities/reply.entity';
import { Notification } from '../notifs/entities/notification.entity';
import { User } from '../user/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Post, Reply, Notification, User])],
  controllers: [ForumController],
  providers: [ForumService],
})
export class ForumModule {}
