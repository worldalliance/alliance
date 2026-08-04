import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Message } from './message.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import type { Relation } from 'src/utils/Repository';
import { Participant } from './participant.entity';
import { Community } from 'src/community/entities/community.entity';

export enum ConversationType {
  Direct = 'direct',
  Multiple = 'multiple',
  Community = 'community',
}

@Entity()
@Check(
  `("type" = 'direct' AND "communityId" IS NULL) OR ("type" = 'multiple' AND "communityId" IS NULL) OR ("type" = 'community' AND "communityId" IS NOT NULL)`,
)
@Unique(['community'])
export class Conversation {
  @PrimaryGeneratedColumn()
  @ApiProperty({ type: Number })
  id: number;

  @OneToMany(() => Message, (message) => message.conversation)
  @ApiProperty({ type: () => Message, isArray: true })
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  messages: Relation<Message>[];

  @CreateDateColumnTz()
  @ApiProperty({ type: Date })
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty({ type: Date })
  updatedAt: Date;

  @OneToMany(() => Participant, (participant) => participant.conversation)
  @ApiProperty({ type: () => Participant, isArray: true })
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  participants: Relation<Participant>[];

  @Column({
    type: 'enum',
    enum: ConversationType,
    enumName: 'ConversationType',
  })
  @ApiProperty({ enum: ConversationType, enumName: 'ConversationType' })
  type: ConversationType;

  @Column()
  @ApiProperty({ type: String })
  title: string;

  @Column({ nullable: true })
  @ApiPropertyOptional({ type: String })
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  photo?: string;

  @ManyToOne(() => Community, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'communityId' })
  @ApiPropertyOptional({ type: () => Community })
  community?: Relation<Community>;
}
