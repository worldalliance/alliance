import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsNotEmpty, IsOptional } from "class-validator";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import {
  Action,
  parseAction,
  type ParsedAction,
} from "../../actions/entities/action.entity";
import { User } from "../../user/entities/user.entity";
import { EditableContent } from "./editablecontent.entity";
import { PostTag } from "./post-tag.entity";

@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @IsNotEmpty()
  title: string;

  @OneToOne(() => EditableContent, {
    cascade: true,
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn()
  @ApiPropertyOptional({ type: () => EditableContent })
  @IsOptional()
  @Type(() => EditableContent)
  editableContent?: Relation<EditableContent>;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn()
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => User)
  author?: Relation<User>;

  @Column()
  @ApiProperty()
  @Allow()
  authorId: number;

  @ManyToOne(() => Action, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn()
  @ApiPropertyOptional({ type: () => Action })
  @IsOptional()
  @Type(() => Action)
  action?: Relation<Action> | null;

  @Column({ nullable: true })
  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @Allow()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  actionId?: number;

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  pinned: boolean;

  @UpdateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  updatedAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @Allow()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  visibleAt?: Date;

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  deleted: boolean;

  @ManyToMany(() => User, { onDelete: "CASCADE" })
  @ApiPropertyOptional({ type: () => User, isArray: true })
  @JoinTable()
  @IsOptional()
  @Type(() => User)
  likes?: Relation<User>[];

  @RelationId((post: Post) => post.likes)
  @ApiProperty({ type: () => Number, isArray: true })
  @Allow()
  likesIds: number[];

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  qaMode: boolean;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @Allow()
  expertLabel: string | null;

  @ManyToMany(() => User, { onDelete: "CASCADE" })
  @ApiPropertyOptional({ type: () => User, isArray: true })
  @JoinTable()
  @IsOptional()
  @Type(() => User)
  experts?: Relation<User>[];

  @RelationId((post: Post) => post.experts)
  @ApiProperty({ type: () => Number, isArray: true })
  @Allow()
  expertIds: number[];

  @ManyToMany(() => User, { onDelete: "CASCADE" })
  @ApiPropertyOptional({ type: () => User, isArray: true })
  @JoinTable()
  @IsOptional()
  @Type(() => User)
  authors?: Relation<User>[];

  @RelationId((post: Post) => post.authors)
  @ApiProperty({ type: () => Number, isArray: true })
  @Allow()
  authorIds: number[];

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  notifyForReplies: boolean;

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  showClusterTags: boolean;

  @OneToMany(() => PostTag, (tag) => tag.post, { cascade: true })
  @ApiPropertyOptional({ type: () => PostTag, isArray: true })
  @IsOptional()
  @Type(() => PostTag)
  tags?: Relation<PostTag>[];
}

/**
 * A Post whose loaded action has been parsed. Produce with {@link parsePost}
 * immediately after pulling a post from the db, so the parse happens exactly
 * once and everything downstream works with a typed expression.
 */
export interface ParsedPost extends Post {
  action?: ParsedAction | null;
}

export function parsePost(post: Post): ParsedPost {
  if (post.action) {
    post.action = parseAction(post.action);
  }
  return post as ParsedPost;
}
