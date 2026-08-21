import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Comment } from "../forum/entities/comment.entity";
import { ForumModule } from "../forum/forum.module";
import { User } from "../user/entities/user.entity";
import { FacepileModule } from "./facepile.module";
import { LikesController } from "./likes.controller";
import { LikesService } from "./likes.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Comment]),
    ForumModule,
    FacepileModule,
  ],
  controllers: [LikesController],
  providers: [LikesService],
})
export class LikesModule {}
