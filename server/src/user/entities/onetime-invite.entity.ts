import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsOptional } from 'class-validator';
import { CreateDateColumnTz } from 'src/datasources/basecolumns';
import { Community } from './community.entity';
import { Ty } from 'src/tasks/entities/type';

export enum OnetimeInviteStatus {
  LINK_UNUSED = 'link_unused',
  LINK_USED = 'link_used',
}

@Entity()
export class OnetimeInvite {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @Allow()
  invitee: string;

  @ApiProperty()
  @Column()
  @Allow()
  code: string;

  @ManyToOne(() => User)
  @ApiProperty({ type: () => User })
  @Type(() => User)
  @JoinColumn({ name: 'invitingUserId' })
  @Allow()
  invitingUser: Ty<User>;

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @Column({
    type: 'enum',
    enum: OnetimeInviteStatus,
  })
  @ApiProperty({
    enum: OnetimeInviteStatus,
    enumName: 'OnetimeInviteStatus',
  })
  @Allow()
  status: OnetimeInviteStatus;

  @ManyToOne(() => Community, (community) => community.invites, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @ApiPropertyOptional({ type: () => Community })
  @Type(() => Community)
  @JoinColumn({ name: 'communityId' })
  @IsOptional()
  community?: Ty<Community>;
}
