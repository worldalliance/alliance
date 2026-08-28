import { byLikeOrder, LIKE_FACEPILE_LIMIT } from "@alliance/common/likeOrder";
import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  PickType,
} from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { ActionDto } from "src/actions/dto/action.dto";
import { ProfileDto } from "../../user/dto/user.dto";
import { Comment } from "../entities/comment.entity";
import { Post, type ParsedPost } from "../entities/post.entity";
import { CommentDto } from "./comment.dto";
import {
  CreateEditableContentDto,
  EditableContentDto,
} from "./editablecontent.dto";
import { PostTagDto } from "./post-tag.dto";

export class PostDto extends PickType(Post, [
  "id",
  "title",
  "actionId",
  "authorId",
  "createdAt",
  "visibleAt",
  "updatedAt",
  "pinned",
  "qaMode",
  "deleted",
  "expertIds",
  "expertLabel",
  "authorIds",
  "notifyForReplies",
  "showClusterTags",
]) {
  @ApiPropertyOptional({ type: () => ActionDto })
  action: ActionDto | undefined;

  @ApiProperty({ type: ProfileDto })
  author: ProfileDto;

  @ApiPropertyOptional({ type: Number })
  commentCount?: number;

  @ApiProperty({ type: () => EditableContentDto })
  editableContent: EditableContentDto;

  /**
   * Bounded facepile; use `likeCount` and `/likes/post/:id/users` for all
   * likers.
   */
  @ApiPropertyOptional({ type: () => ProfileDto, isArray: true })
  likes?: ProfileDto[];

  /** Undefined for anonymous/admin views. */
  @ApiPropertyOptional({ type: Boolean })
  likedByMe?: boolean;

  @ApiPropertyOptional({ type: () => CommentDto })
  lastComment?: CommentDto;

  @ApiPropertyOptional({ type: Number })
  likeCount?: number;

  @ApiPropertyOptional({ type: () => ProfileDto, isArray: true })
  experts?: ProfileDto[];

  @ApiPropertyOptional({ type: () => ProfileDto, isArray: true })
  authors?: ProfileDto[];

  @ApiPropertyOptional({ type: () => PostTagDto, isArray: true })
  tags?: PostTagDto[];

  constructor({
    post,
    commentCount,
    lastComment,
    requestingUserId,
  }: PostDtoArgs) {
    super();
    if (!post.editableContent) {
      throw new Error(`Post ${post.id} was loaded without editableContent`);
    }
    if (!post.author) {
      throw new Error(`Post ${post.id} was loaded without author`);
    }
    this.id = post.id;
    this.title = post.title;
    this.actionId = post.actionId;
    this.authorId = post.authorId;
    this.createdAt = post.visibleAt ?? post.createdAt;
    this.visibleAt = post.visibleAt;
    this.updatedAt = post.updatedAt;
    this.pinned = post.pinned;
    this.qaMode = post.qaMode;
    this.deleted = post.deleted;
    this.expertIds = post.expertIds;
    this.expertLabel = post.expertLabel;
    this.authorIds = post.authorIds;
    this.notifyForReplies = post.notifyForReplies;
    this.showClusterTags = post.showClusterTags;
    this.action = post.action ? new ActionDto(post.action) : undefined;
    this.author = new ProfileDto(post.author);
    this.commentCount = commentCount;
    this.editableContent = new EditableContentDto(post.editableContent);
    const likerIds = post.likesIds ?? post.likes?.map((like) => like.id);
    this.likes = post.likes
      ? post.likes
          .map((like) => new ProfileDto(like))
          .sort(byLikeOrder(post.id))
          .slice(0, LIKE_FACEPILE_LIMIT)
      : undefined;
    this.likedByMe =
      requestingUserId !== undefined
        ? (likerIds?.includes(requestingUserId) ?? false)
        : undefined;
    this.lastComment = lastComment
      ? new CommentDto(lastComment, { requestingUserId })
      : undefined;
    this.likeCount = likerIds?.length;
    this.experts = post.experts
      ? post.experts.map((expert) => new ProfileDto(expert))
      : undefined;
    this.authors = post.authors
      ? post.authors.map((author) => new ProfileDto(author))
      : undefined;
    this.tags = post.tags
      ? [...post.tags]
          .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
          .map((tag) => new PostTagDto(tag))
      : undefined;
  }
}

export type PostDtoArgs = {
  post: ParsedPost;
  commentCount?: number;
  lastComment?: Comment;
  requestingUserId?: number;
};

export class CreatePostDto extends PickType(Post, [
  "title",
  "actionId",
  "visibleAt",
]) {
  @ApiProperty({ type: CreateEditableContentDto })
  @ValidateNested()
  @Type(() => CreateEditableContentDto)
  @IsDefined()
  editableContent: CreateEditableContentDto;
}

export class UpdatePostDto extends PartialType(CreatePostDto) {}

export class UpdatePostExpertsDto {
  @ApiProperty({ type: Number, isArray: true })
  @IsArray()
  @IsInt({ each: true })
  expertIds: number[];

  @ApiProperty()
  @IsBoolean()
  qaMode: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || null : value,
  )
  @IsString()
  @MaxLength(64)
  expertLabel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyForReplies?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showClusterTags?: boolean;
}

export class UpdatePostAuthorsDto {
  @ApiProperty({ type: Number, isArray: true })
  @IsArray()
  @IsInt({ each: true })
  authorIds: number[];
}
