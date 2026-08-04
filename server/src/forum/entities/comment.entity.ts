import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsNotEmpty, IsOptional } from 'class-validator';
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
} from 'typeorm';
import { Notification } from '../../notifs/entities/notification.entity';
import { User } from '../../user/entities/user.entity';
import { EditableContent } from './editablecontent.entity';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import type { Relation } from 'src/utils/Repository';

export enum CommentParentObject {
  Post = 'post',
  Action = 'action',
  Activity = 'activity',
}

@Entity()
export class Comment {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @OneToOne(() => EditableContent, {
    cascade: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  @ApiPropertyOptional({ type: () => EditableContent })
  @IsOptional()
  @Type(() => EditableContent)
  editableContent?: Relation<EditableContent>;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  @ApiProperty()
  @Allow()
  @Type(() => User)
  author: Relation<User>;

  @Column()
  @ApiProperty()
  @Allow()
  authorId: number;

  @Column({ type: 'enum', enum: CommentParentObject })
  @ApiProperty({
    enum: CommentParentObject,
    enumName: 'CommentParentObject',
  })
  @Allow()
  parentObjectType: CommentParentObject;

  @Column()
  @ApiProperty()
  @IsNotEmpty()
  parentObjectId: number;

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  deleted: boolean;

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
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  @ApiProperty({ type: () => Comment, required: false })
  @Allow()
  @IsOptional()
  parent: Relation<Comment> | null;

  @Column({ nullable: true })
  @IsOptional()
  @ApiPropertyOptional()
  parentId?: number;

  @OneToMany(() => Comment, (comment) => comment.parent)
  @ApiProperty({ type: () => Comment, required: false, isArray: true })
  @Allow()
  @Type(() => Comment)
  children: Relation<Comment>[];

  @OneToMany(() => Notification, (notification) => notification.comment)
  @Allow()
  @Type(() => Notification)
  notifications: Relation<Notification>[];

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  pinned: boolean;

  @ManyToMany(() => User, { onDelete: 'CASCADE' })
  @ApiProperty({ type: () => User, isArray: true })
  @JoinTable()
  @Allow()
  @Type(() => User)
  likes: Relation<User>[];

  @Column({ default: 0 })
  @ApiProperty()
  @Allow()
  likesCount: number;
}
