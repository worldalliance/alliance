import { Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'src/utils/Repository';
import { User } from '../../user/entities/user.entity';
import { Column } from 'typeorm';
import { CreateDateColumnTz } from 'src/datasources/basecolumns';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum UnreadContentType {
  ActionEvent = 'action_event',
  ForumReply = 'forum_reply',
  ActionUpdate = 'action_update',
}

@Entity()
export class UnreadContent {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  user: Relation<User>;

  @Column({ type: 'enum', enum: UnreadContentType })
  @ApiProperty({ enum: UnreadContentType, enumName: 'UnreadContentType' })
  contentType: UnreadContentType;

  @Column()
  @ApiProperty()
  contentId: number;

  @Column({ type: 'varchar', nullable: true })
  @ApiProperty({ nullable: true })
  groupingKey: string | null;

  @CreateDateColumnTz()
  @ApiProperty({ type: Date })
  @Type(() => Date)
  createdAt: Date;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  @ApiProperty({ type: Date })
  @Type(() => Date)
  sendTime: Date;

  @Column({ type: 'timestamptz', nullable: true })
  @ApiProperty({ type: Date, nullable: true })
  @Type(() => Date)
  readAt: Date | null;

  @Column({ default: true })
  @ApiProperty()
  shouldPush: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  @ApiProperty({ type: Date, nullable: true })
  @Type(() => Date)
  pushDispatchedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({ nullable: true })
  pushClaimedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  @ApiProperty({ type: Date, nullable: true })
  pushClaimedAt: Date | null;
}
