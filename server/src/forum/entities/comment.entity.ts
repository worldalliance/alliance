import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  Allow,
  IsBoolean,
  IsEmpty,
  IsNotEmpty,
  IsOptional,
} from "class-validator";
import {
  CreateDateColumnTz,
  DeleteDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Notification } from "../../notifs/entities/notification.entity";
import { User } from "../../user/entities/user.entity";
import { EditableContent } from "./editablecontent.entity";
import { PostTag } from "./post-tag.entity";

export enum CommentParentObject {
  Post = "post",
  Action = "action",
  Activity = "activity",
}

@Entity()
@Index(["authorId"])
@Index(["parentId"])
export class Comment {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

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
  @ApiProperty()
  @Allow()
  @Type(() => User)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  author: Relation<User>;

  @Column()
  @ApiProperty()
  @Allow()
  authorId: number;

  @Column({ type: "enum", enum: CommentParentObject })
  @ApiProperty({
    enum: CommentParentObject,
    enumName: "CommentParentObject",
  })
  @Allow()
  parentObjectType: CommentParentObject;

  @Column()
  @ApiProperty()
  @IsNotEmpty()
  parentObjectId: number;

  @DeleteDateColumnTz()
  @IsOptional()
  @IsEmpty()
  deletedAt: Date | null;

  // Dropped with LegacyDeletedFlagService's trigger; see its TODO.
  // Write-only: `select: false` leaves it undefined on a loaded row.
  @Column({ name: "deleted", default: false, select: false })
  @IsBoolean()
  legacyDeleted: boolean;

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  updatedAt: Date;

  @ManyToOne(() => Comment, (comment) => comment.children, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn()
  @ApiPropertyOptional({ type: () => Comment })
  @Allow()
  @IsOptional()
  parent?: Relation<Comment> | null;

  @Column({ type: "int", nullable: true })
  @IsOptional()
  @ApiProperty({ type: Number, nullable: true })
  parentId: number | null;

  @OneToMany(() => Comment, (comment) => comment.parent)
  @ApiProperty({ type: () => Comment, required: false, isArray: true })
  @Allow()
  @Type(() => Comment)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  children: Relation<Comment>[];

  @OneToMany(() => Notification, (notification) => notification.comment)
  @Allow()
  @Type(() => Notification)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  notifications: Relation<Notification>[];

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  pinned: boolean;

  @ManyToMany(() => User, { onDelete: "CASCADE" })
  @ApiPropertyOptional({ type: () => User, isArray: true })
  @JoinTable()
  @IsOptional()
  @Type(() => User)
  likes?: Relation<User>[];

  @Column({ default: 0 })
  @ApiProperty()
  @Allow()
  likesCount: number;

  @ManyToOne(() => PostTag, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn()
  @ApiPropertyOptional({ type: () => PostTag })
  @IsOptional()
  @Type(() => PostTag)
  tag?: Relation<PostTag> | null;

  @Column({ type: "int", nullable: true })
  @ApiProperty({ type: Number, nullable: true })
  @IsOptional()
  tagId: number | null;
}
