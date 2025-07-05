import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../user/user.entity';
import { Post } from './post.entity';
import { Notification } from '../../notifs/entities/notification.entity';
import { IsNotEmpty } from 'class-validator';

@Entity()
export class Reply {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column('text')
  @ApiProperty()
  @IsNotEmpty()
  content: string;

  @ManyToOne(() => User)
  @JoinColumn()
  @ApiProperty()
  author: User;

  @Column()
  @ApiProperty()
  authorId: number;

  @ManyToOne(() => Post, (post) => post.replies, { onDelete: 'CASCADE' })
  @JoinColumn()
  @ApiProperty({ type: () => Post })
  post: Post;

  @Column()
  @ApiProperty()
  @IsNotEmpty()
  postId: number;

  @CreateDateColumn()
  @ApiProperty()
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty()
  updatedAt: Date;

  @OneToOne(() => Notification, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  notification: Notification;
}
