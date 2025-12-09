import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum EmailType {
  Verification = 'verification',
  PasswordReset = 'password_reset',
  PartialSignup = 'partial_signup',
  Welcome = 'welcome',
  Other = 'other',
  Commitment = 'commitment',
  MemberAction = 'memberaction',
  CommitmentReminder = 'commitmentreminder',
  MemberActionReminder = 'memberactionreminder',
  ForumDigest = 'forum_digest',
  MissedDeadline = 'missed_deadline',
  MissedSecondDeadline = 'missed_second_deadline',
  CustomActionReminder = 'custom_action_reminder',
  ContractSuspended = 'contract_suspended',
}

export enum EmailStatus {
  Pending = 'pending',
  Sent = 'sent',
  Failed = 'failed',
}

@Entity()
export class Mail {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column({ type: 'text', nullable: true })
  @ApiPropertyOptional()
  sentMessageId?: string;

  @Column({ type: 'text', nullable: true })
  @ApiPropertyOptional()
  renderedHtml?: string;

  @ApiProperty()
  @Column()
  to: string;

  @ApiProperty()
  @Column()
  status: string;

  @Column({ type: 'enum', enum: EmailType, enumName: 'EmailType' })
  @ApiProperty({ enum: EmailType, enumName: 'EmailType' })
  emailType: EmailType;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  cid?: string;

  @Column({ default: false })
  @ApiProperty({ type: Boolean })
  clickedLink: boolean;
}
