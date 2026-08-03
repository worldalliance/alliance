import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { CreateDateColumnTz } from 'src/datasources/basecolumns';

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
  ForumReply = 'forum_reply',
  MissedDeadline = 'missed_deadline',
  MissedSecondDeadline = 'missed_second_deadline',
  CustomActionReminder = 'custom_action_reminder',
  ContractSuspended = 'contract_suspended',
  ContractReminder = 'contract_reminder',
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
  @ApiProperty({ nullable: true })
  sentMessageId: string | null;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({ nullable: true })
  renderedHtml: string | null;

  @ApiProperty()
  @Column()
  to: string;

  @ApiProperty({ enum: EmailStatus, enumName: 'EmailStatus' })
  @Column({ type: 'enum', enum: EmailStatus, enumName: 'EmailStatus' })
  status: EmailStatus;

  @Column({ type: 'enum', enum: EmailType, enumName: 'EmailType' })
  @ApiProperty({ enum: EmailType, enumName: 'EmailType' })
  emailType: EmailType;

  @ApiProperty()
  @CreateDateColumnTz()
  createdAt: Date;

  @Column({ type: 'varchar', nullable: true })
  @ApiProperty({ nullable: true })
  cid: string | null;

  @Column({ default: false })
  @ApiProperty({ type: Boolean })
  clickedLink: boolean;
}
