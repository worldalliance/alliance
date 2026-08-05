import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import { User } from 'src/user/entities/user.entity';
import type { Relation } from 'src/utils/Repository';

@Entity()
export class Message {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  id: string;

  @Column()
  @ApiProperty()
  body: string;

  @Column({ type: 'jsonb', default: [] })
  @ApiProperty({
    type: String,
    isArray: true,
    description: 'Image keys attached to the content',
  })
  attachments: string[];

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  @ApiProperty({ type: () => User })
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  author: Relation<User>;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversationId' })
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  conversation: Relation<Conversation>;

  @CreateDateColumnTz()
  @ApiProperty({ type: Date })
  createdAt: Date;

  @UpdateDateColumnTz()
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  @ApiPropertyOptional({ type: Date })
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  deletedAt?: Date;

  @ManyToOne(() => Message, (message) => message.replies)
  @JoinColumn({ name: 'replyToId' })
  @ApiProperty({ type: () => Message, required: false })
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  replyTo: Relation<Message>;

  @OneToMany(() => Message, (message) => message.replyTo)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  replies: Relation<Message>[];
}
