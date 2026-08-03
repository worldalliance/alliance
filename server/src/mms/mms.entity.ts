import { ApiProperty } from '@nestjs/swagger';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from '../datasources/basecolumns';
import type { MessageStatus } from 'twilio/lib/rest/api/v2010/account/message';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Mms {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column({
    comment:
      'Twilio recipient address; may be E.164, a short code, or a channel address',
  })
  @ApiProperty()
  to: string;

  @Column({
    comment:
      'Twilio sender identifier; may be E.164, a short code, or alphanumeric',
  })
  @ApiProperty()
  from: string;

  @Column()
  @ApiProperty()
  body: string;

  @Column({ type: 'text' })
  @ApiProperty({ type: String })
  status: MessageStatus;

  @Column()
  @ApiProperty()
  twilioSid: string;

  @Column({ type: 'int', nullable: true })
  @ApiProperty({ nullable: true })
  errorCode: number | null;

  @Column({ type: 'varchar', nullable: true })
  @ApiProperty({ nullable: true })
  errorMessage: string | null;

  @CreateDateColumnTz()
  @ApiProperty()
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty()
  updatedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  @ApiProperty({ nullable: true })
  cid: string | null;

  @Column({ default: false })
  @ApiProperty({ type: Boolean })
  clickedLink: boolean;
}
