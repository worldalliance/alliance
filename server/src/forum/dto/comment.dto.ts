import { byLikeOrder, LIKE_FACEPILE_LIMIT } from '@alliance/common/likeOrder';
import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  PickType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ProfileDto } from 'src/user/dto/user.dto';
import { Comment } from '../entities/comment.entity';
import {
  CreateEditableContentDto,
  EditableContentDto,
} from './editablecontent.dto';

export class CommentDto extends PickType(Comment, [
  'id',
  'parentObjectId',
  'parentId',
  'parentObjectType',
  'createdAt',
  'updatedAt',
  'deleted',
  'pinned',
]) {
  @ApiProperty({ type: ProfileDto })
  author: ProfileDto;

  @ApiPropertyOptional({ type: () => CommentDto, isArray: true })
  children?: CommentDto[];

  /**
   * Bounded facepile; use `likesCount` and `/likes/comment/:id/users` for all
   * likers.
   */
  @ApiProperty({ type: () => ProfileDto, isArray: true })
  likes: ProfileDto[];

  @ApiProperty()
  likesCount: number;

  /** Undefined for anonymous/admin views. */
  @ApiPropertyOptional({ type: Boolean })
  likedByMe?: boolean;

  @ApiProperty({ type: () => EditableContentDto })
  editableContent: EditableContentDto;

  constructor(comment: Comment, requestingUserId?: number) {
    super();
    if (!comment.editableContent) {
      throw new Error(
        `Comment ${comment.id} was loaded without editableContent`,
      );
    }
    const allLikes = comment.likes ?? [];
    this.id = comment.id;
    this.parentObjectId = comment.parentObjectId;
    this.parentId = comment.parentId;
    this.parentObjectType = comment.parentObjectType;
    this.createdAt = comment.createdAt;
    this.updatedAt = comment.updatedAt;
    this.deleted = comment.deleted;
    this.pinned = comment.pinned;
    this.author = new ProfileDto(comment.author);
    this.children = comment.children
      ? comment.children.map((child) => new CommentDto(child, requestingUserId))
      : undefined;
    this.likesCount = comment.likesCount ?? allLikes.length;
    this.likedByMe =
      requestingUserId !== undefined && comment.likes !== undefined
        ? allLikes.some((like) => like.id === requestingUserId)
        : undefined;
    this.likes = allLikes
      .map((like) => new ProfileDto(like))
      .sort(byLikeOrder(comment.id))
      .slice(0, LIKE_FACEPILE_LIMIT);
    this.editableContent = new EditableContentDto(comment.editableContent);
  }
}

export class UserCommentDto extends CommentDto {
  @ApiPropertyOptional()
  parentTitle?: string;

  constructor(
    { comment, parentTitle }: UserComment,
    requestingUserId?: number,
  ) {
    super(comment, requestingUserId);
    this.parentTitle = parentTitle;
  }
}

export type UserComment = { comment: Comment; parentTitle?: string };

export class CreateCommentDto extends PickType(Comment, [
  'parentObjectId',
  'parentId',
  'parentObjectType',
]) {
  @ApiProperty({ type: CreateEditableContentDto })
  @ValidateNested()
  @Type(() => CreateEditableContentDto)
  editableContent: CreateEditableContentDto;
}

export class UpdateCommentDto extends PartialType(CreateCommentDto) {}
