import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  PickType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { ActionDto } from 'src/actions/dto/action.dto';
import { ProfileDto } from '../../user/dto/user.dto';
import { Post } from '../entities/post.entity';
import {
  CreateEditableContentDto,
  EditableContentDto,
} from './editablecontent.dto';
import { CommentDto } from './comment.dto';
import { Comment } from '../entities/comment.entity';

// return object for get requests
export class PostDto extends PickType(Post, [
  'id',
  'title',
  'actionId',
  'authorId',
  'createdAt',
  'visibleAt',
  'updatedAt',
  'pinned',
  'qaMode',
  'expertIds',
  'expertLabel',
  'authorIds',
]) {
  //redefine to use compacted dto types
  @ApiPropertyOptional({ type: () => ActionDto })
  action: ActionDto | undefined;

  @ApiProperty({ type: ProfileDto })
  author: ProfileDto;

  @ApiPropertyOptional({ type: Number })
  commentCount?: number;

  @ApiProperty({ type: () => EditableContentDto })
  editableContent: EditableContentDto;

  @ApiPropertyOptional({ type: () => ProfileDto, isArray: true })
  likes?: ProfileDto[];

  @ApiPropertyOptional({ type: () => CommentDto })
  lastComment?: CommentDto;

  @ApiPropertyOptional({ type: Number })
  likeCount?: number;

  @ApiPropertyOptional({ type: () => ProfileDto, isArray: true })
  experts?: ProfileDto[];

  @ApiPropertyOptional({ type: () => ProfileDto, isArray: true })
  authors?: ProfileDto[];

  constructor(
    post: Post,
    extras?: { commentCount?: number; lastComment?: Comment },
  ) {
    super();
    Object.assign(this, post);
    this.author = new ProfileDto(post.author);
    this.commentCount = extras?.commentCount;
    this.likes = post.likes
      ? post.likes.map((like) => new ProfileDto(like))
      : undefined;
    this.experts = post.experts
      ? post.experts.map((expert) => new ProfileDto(expert))
      : undefined;
    this.authors = post.authors
      ? post.authors.map((author) => new ProfileDto(author))
      : undefined;
    this.editableContent = new EditableContentDto(post.editableContent);
    this.createdAt = post.visibleAt ?? post.createdAt;
    this.lastComment = extras?.lastComment
      ? new CommentDto(extras?.lastComment)
      : undefined;
    this.likeCount = post.likesIds?.length;
  }
}

export class CreatePostDto extends PickType(Post, [
  'title',
  'actionId',
  'visibleAt',
]) {
  @ApiProperty({ type: CreateEditableContentDto })
  @ValidateNested()
  @Type(() => CreateEditableContentDto)
  @IsDefined()
  editableContent: CreateEditableContentDto;
}

export class UpdatePostDto extends PartialType(CreatePostDto) {}

export class UpdatePostExpertsDto {
  @ApiProperty({ type: [Number] })
  @IsDefined()
  expertIds: number[];

  @ApiProperty()
  @IsDefined()
  qaMode: boolean;

  @ApiPropertyOptional()
  expertLabel?: string;
}

export class UpdatePostAuthorsDto {
  @ApiProperty({ type: [Number] })
  @IsDefined()
  authorIds: number[];
}
