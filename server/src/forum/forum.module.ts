import { Module } from '@nestjs/common';
import { ForumService } from './forum.service';
import { ForumController } from './forum.controller';

@Module({
  controllers: [ForumController],
  providers: [ForumService],
})
export class ForumModule {}
