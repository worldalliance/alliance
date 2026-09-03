import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ActionsModule } from "../actions/actions.module";
import { ActionActivity } from "../actions/entities/action-activity.entity";
import { Comment } from "../forum/entities/comment.entity";
import { ForumModule } from "../forum/forum.module";
import { User } from "../user/entities/user.entity";
import { FacepileModule } from "./facepile.module";
import { LikesController } from "./likes.controller";
import { LikesService } from "./likes.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Comment, ActionActivity]),
    ForumModule,
    FacepileModule,
    forwardRef(() => ActionsModule),
  ],
  controllers: [LikesController],
  providers: [LikesService],
})
export class LikesModule {}
