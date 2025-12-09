import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsOptional } from 'class-validator';
import { CreateDateColumnTz } from 'src/datasources/basecolumns';
import { Community } from './community.entity';
import { Ty } from 'src/tasks/entities/type';
import { Notification } from 'src/notifs/entities/notification.entity';

@Entity()
export class OnetimeInviteRequest {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @Allow()
  invitee: string;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  inviteeDescription?: string;

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

  @ManyToOne(() => Community, (community) => community.invites, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @ApiProperty({ type: () => Community })
  @Type(() => Community)
  @JoinColumn({ name: 'communityId' })
  @Allow()
  community: Ty<Community>;

  @OneToMany(() => Notification, (notif) => notif.onetimeInviteRequest)
  @Type(() => Notification)
  @ApiProperty({ type: () => Notification, isArray: true })
  @Allow()
  notifs: Ty<Notification>[];
}
