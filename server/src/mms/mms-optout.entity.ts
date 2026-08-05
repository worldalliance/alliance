import { ApiProperty } from '@nestjs/swagger';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import type { Relation } from 'src/utils/Repository';
import { User } from 'src/user/entities/user.entity';
import { phoneNumberTransformer } from 'src/utils/phone';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class MmsOptout {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  id: string;

  @Column({
    comment: 'E.164 format (+15551234567)',
    transformer: phoneNumberTransformer,
  })
  @ApiProperty()
  phoneNumber: string;

  @Column()
  @ApiProperty()
  reason: string;

  @CreateDateColumnTz()
  @ApiProperty()
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty()
  updatedAt: Date;

  @Column()
  @ApiProperty()
  rawBody: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  @ApiProperty({ type: () => User })
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  user: Relation<User>;
}
