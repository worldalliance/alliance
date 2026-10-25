import {
  ACTION_ACTIVITY_FEED_VISIBLE_TYPES,
  type FeedActionActivity,
} from "@alliance/common/actionActivity";
import type { DisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsOptional } from "class-validator";
import { CommentDto } from "src/forum/dto/comment.dto";
import type { ForumFeedComment } from "src/forum/forum-comment-query.service";
import { ProfileDto } from "src/user/dto/user.dto";
import { ActionEvent } from "../entities/action-event.entity";
import { ActionUpdate } from "../entities/action-update.entity";
import { type ParsedAction } from "../entities/action.entity";
import { ActionActivityDto } from "./action-activity.dto";
import { ActionEventDto } from "./action-event.dto";
import { ActionUpdateDto } from "./action-update.dto";
import { ActionDto } from "./action.dto";

export enum GlobalFeedItemType {
  ActivityGroup = "activity_group",
  ActionUpdate = "action_update",
  NewMembers = "new_members",
  ForumComments = "forum_comments",
}

export class GlobalFeedActivityGroupDto {
  @ApiProperty({ type: () => ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  users: ProfileDto[];

  @ApiProperty()
  actionId: number;

  @ApiProperty()
  actionName: string;

  @ApiProperty({
    enum: ACTION_ACTIVITY_FEED_VISIBLE_TYPES,
    enumName: "GlobalFeedActivityTypes",
  })
  activityType: FeedActionActivity;

  @ApiProperty()
  count: number;
}

export class GlobalFeedActionUpdateDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  title: string;

  @ApiProperty()
  @Type(() => Object)
  schema: DisplayOnlySchema;

  @ApiProperty()
  date: Date;

  @ApiProperty()
  actionId: number;

  @ApiProperty()
  actionName: string;
}

export class GlobalFeedNewMembersDto {
  @ApiProperty({ type: () => ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  users: ProfileDto[];

  @ApiProperty()
  count: number;
}

export class GlobalFeedForumCommentsDto {
  @ApiProperty({ type: () => ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  users: ProfileDto[];

  @ApiProperty()
  postId: number;

  @ApiProperty()
  postTitle: string;

  @ApiProperty()
  count: number;

  @ApiPropertyOptional()
  commentId?: number;
}

export type GlobalFeedItem = {
  date: Date;
} & (
  | {
      type: GlobalFeedItemType.ActivityGroup;
      activityGroup: GlobalFeedActivityGroupDto;
      actionUpdate?: undefined;
      newMembers?: undefined;
      forumComments?: undefined;
    }
  | {
      type: GlobalFeedItemType.ActionUpdate;
      activityGroup?: undefined;
      actionUpdate: GlobalFeedActionUpdateDto;
      newMembers?: undefined;
      forumComments?: undefined;
    }
  | {
      type: GlobalFeedItemType.NewMembers;
      activityGroup?: undefined;
      actionUpdate?: undefined;
      newMembers: GlobalFeedNewMembersDto;
      forumComments?: undefined;
    }
  | {
      type: GlobalFeedItemType.ForumComments;
      activityGroup?: undefined;
      actionUpdate?: undefined;
      newMembers?: undefined;
      forumComments: GlobalFeedForumCommentsDto;
    }
);

export class GlobalFeedItemDto {
  @ApiProperty({ enum: GlobalFeedItemType, enumName: "GlobalFeedItemType" })
  @Allow()
  type: GlobalFeedItemType;

  @ApiProperty()
  @Type(() => Date)
  @Allow()
  date: Date;

  @ApiPropertyOptional({ type: () => GlobalFeedActivityGroupDto })
  @Type(() => GlobalFeedActivityGroupDto)
  @IsOptional()
  activityGroup?: GlobalFeedActivityGroupDto;

  @ApiPropertyOptional({ type: () => GlobalFeedActionUpdateDto })
  @Type(() => GlobalFeedActionUpdateDto)
  @IsOptional()
  actionUpdate?: GlobalFeedActionUpdateDto;

  @ApiPropertyOptional({ type: () => GlobalFeedNewMembersDto })
  @Type(() => GlobalFeedNewMembersDto)
  @IsOptional()
  newMembers?: GlobalFeedNewMembersDto;

  @ApiPropertyOptional({ type: () => GlobalFeedForumCommentsDto })
  @Type(() => GlobalFeedForumCommentsDto)
  @IsOptional()
  forumComments?: GlobalFeedForumCommentsDto;

  constructor(input: GlobalFeedItem) {
    this.type = input.type;
    this.date = input.date;
    if (input.type === GlobalFeedItemType.ActivityGroup) {
      this.activityGroup = input.activityGroup;
    } else if (input.type === GlobalFeedItemType.ActionUpdate) {
      this.actionUpdate = input.actionUpdate;
    } else if (input.type === GlobalFeedItemType.NewMembers) {
      this.newMembers = input.newMembers;
    } else if (input.type === GlobalFeedItemType.ForumComments) {
      this.forumComments = input.forumComments;
    }
  }
}

export enum TimelineFeedItemType {
  ActionUpdate = "action_update",
  ActionEvent = "action_event",
}

export type TimelineFeedItem = {
  date: Date;
  action: ParsedAction;
} & (
  | {
      type: TimelineFeedItemType.ActionEvent;
      actionEvent: ActionEvent;
      actionUpdate?: undefined;
    }
  | {
      type: TimelineFeedItemType.ActionUpdate;
      actionEvent?: undefined;
      actionUpdate: ActionUpdate;
    }
);

export class TimelineFeedItemDto {
  @ApiProperty({ enum: TimelineFeedItemType, enumName: "TimelineFeedItemType" })
  @Allow()
  type: TimelineFeedItemType;

  @ApiProperty()
  @Type(() => Date)
  @Allow()
  date: Date;

  @ApiProperty({ type: () => ActionDto })
  @Type(() => ActionDto)
  @Allow()
  action: ActionDto;

  @ApiPropertyOptional({ type: () => ActionUpdateDto })
  @Type(() => ActionUpdateDto)
  @IsOptional()
  actionUpdate?: ActionUpdateDto;

  @ApiPropertyOptional({ type: () => ActionEventDto })
  @Type(() => ActionEventDto)
  @IsOptional()
  actionEvent?: ActionEventDto;

  constructor(input: TimelineFeedItem) {
    this.type = input.type;
    this.date = input.date;
    this.action = new ActionDto(input.action);
    switch (input.type) {
      case TimelineFeedItemType.ActionEvent:
        this.actionEvent = new ActionEventDto(input.actionEvent);
        break;
      case TimelineFeedItemType.ActionUpdate:
        this.actionUpdate = new ActionUpdateDto(input.actionUpdate);
        break;
      default:
        input satisfies never;
        throw new Error(
          `Unknown timeline feed item type: ${(input as { type: unknown }).type}`,
        );
    }
  }
}

export enum HomeFeedItemType {
  Activity = "activity",
  ForumComment = "forum_comment",
}

export class HomeFeedForumCommentDto {
  @ApiProperty({ type: () => CommentDto })
  @Type(() => CommentDto)
  comment: CommentDto;

  @ApiProperty()
  postId: number;

  @ApiProperty()
  postTitle: string;

  @ApiProperty()
  likedByMe: boolean;

  @ApiProperty()
  likesCount: number;

  constructor(input: ForumFeedComment) {
    this.comment = new CommentDto(input.comment, { facepile: input.facepile });
    this.postId = input.postId;
    this.postTitle = input.postTitle;
    this.likedByMe = input.likedByMe;
    this.likesCount = input.likesCount;
  }
}

export type HomeFeedItem = {
  date: Date;
} & (
  | {
      type: HomeFeedItemType.Activity;
      activity: ActionActivityDto;
      forumComment?: undefined;
    }
  | {
      type: HomeFeedItemType.ForumComment;
      activity?: undefined;
      forumComment: ForumFeedComment;
    }
);

export class HomeFeedItemDto {
  @ApiProperty({ enum: HomeFeedItemType, enumName: "HomeFeedItemType" })
  @Allow()
  type: HomeFeedItemType;

  @ApiProperty()
  @Type(() => Date)
  @Allow()
  date: Date;

  @ApiPropertyOptional({ type: () => ActionActivityDto })
  @Type(() => ActionActivityDto)
  @IsOptional()
  activity?: ActionActivityDto;

  @ApiPropertyOptional({ type: () => HomeFeedForumCommentDto })
  @Type(() => HomeFeedForumCommentDto)
  @IsOptional()
  forumComment?: HomeFeedForumCommentDto;

  constructor(input: HomeFeedItem) {
    this.type = input.type;
    this.date = input.date;
    switch (input.type) {
      case HomeFeedItemType.Activity:
        this.activity = input.activity;
        break;
      case HomeFeedItemType.ForumComment:
        this.forumComment = new HomeFeedForumCommentDto(input.forumComment);
        break;
      default:
        input satisfies never;
        throw new Error(
          `Unknown home feed item type: ${(input as { type: unknown }).type}`,
        );
    }
  }
}
