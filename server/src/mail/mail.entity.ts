import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum EmailType {
  Verification = 'verification',
  PasswordReset = 'password_reset',
  Welcome = 'welcome',
  Other = 'other',
}

export enum EmailStatus {
  Pending = 'pending',
  Sent = 'sent',
  Failed = 'failed',
}

@Entity()
export class Mail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: true })
  sentMessageId: string | null;

  @Column()
  to: string;

  @Column()
  status: string;

  @Column({ type: 'text' })
  emailType: EmailType;

  @CreateDateColumn()
  createdAt: Date;
}
