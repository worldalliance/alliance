import { Allow, IsDefined, IsOptional } from 'class-validator';
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from './user.entity';
import { Type } from 'class-transformer';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import { OnetimeInvite } from './onetime-invite.entity';
import { CommunityInvite } from './community-invite.entity';

@Entity()
export class Community {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @Allow()
  name: string;

  @Column({ nullable: true })
  @ApiProperty()
  @Allow()
  description: string;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  photo?: string;

  @ManyToMany(() => User, (user) => user.communities)
  @ApiPropertyOptional({ type: () => User, isArray: true })
  @JoinTable()
  @Type(() => User)
  @IsOptional()
  users?: User[];

  @ManyToMany(() => User, (user) => user.leaderOf)
  @ApiPropertyOptional({ type: () => User, isArray: true })
  @JoinTable()
  @Type(() => User)
  @IsOptional()
  leaders?: User[];

  @CreateDateColumnTz()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @UpdateDateColumnTz()
  @Allow()
  @Type(() => Date)
  updatedAt: Date;

  @OneToMany(() => OnetimeInvite, (invite) => invite.community)
  @ApiPropertyOptional({ type: () => OnetimeInvite, isArray: true })
  @Type(() => OnetimeInvite)
  @IsOptional()
  invites?: OnetimeInvite[];

  @OneToMany(() => CommunityInvite, (invite) => invite.community)
  @ApiProperty({ type: () => CommunityInvite, isArray: true })
  @Type(() => CommunityInvite)
  @IsDefined()
  internalInvites: CommunityInvite[];
}
