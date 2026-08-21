import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsDefined, IsOptional } from "class-validator";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import { OnetimeInvite } from "src/user/entities/onetime-invite.entity";
import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import {
  Check,
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { CommunityInvite } from "./community-invite.entity";

@Entity()
@Check(
  // Max capacity is required if the community is public or allows member invites or staff assignments
  '("public" = false AND "allowMemberInvites" = false AND "allowStaffAssignments" = false) OR ("maxCapacity" IS NOT NULL)',
)
@Check(
  "chk_public_requires_member_invites",
  '("public" = false) OR ("allowMemberInvites" = true)',
)
@Check(
  "chk_public_requires_staff_assignments",
  '("public" = false) OR ("allowStaffAssignments" = true)',
)
export class Community {
  // Fields

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
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  description: string;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  photo?: string;

  @CreateDateColumnTz()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @UpdateDateColumnTz()
  @Allow()
  @Type(() => Date)
  updatedAt: Date;

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  public: boolean;

  @Column({ default: true })
  @ApiProperty()
  @Allow()
  allowMemberInvites: boolean;

  @Column({ default: true })
  @ApiProperty()
  @Allow()
  allowStaffAssignments: boolean;

  @Column({ type: "int", nullable: true, default: 10 })
  @ApiProperty({ type: Number, nullable: true, default: 10 })
  @IsOptional()
  maxCapacity: number | null;

  // Relations

  @ManyToMany(() => User, (user) => user.communities)
  @ApiProperty({ type: () => User, isArray: true })
  @JoinTable()
  @Type(() => User)
  @Allow()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  users: Relation<User>[];

  @ManyToMany(() => User, (user) => user.leaderOf)
  @ApiPropertyOptional({ type: () => User, isArray: true })
  @JoinTable()
  @Type(() => User)
  @IsOptional()
  leaders?: Relation<User>[];

  @OneToMany(() => User, (user) => user.pendingCommunity)
  @ApiPropertyOptional({ type: () => User, isArray: true })
  @Type(() => User)
  @IsOptional()
  pendingUsers?: Relation<User>[];

  @OneToMany(() => OnetimeInvite, (invite) => invite.community)
  @ApiPropertyOptional({ type: () => OnetimeInvite, isArray: true })
  @Type(() => OnetimeInvite)
  @IsOptional()
  invites?: Relation<OnetimeInvite>[];

  @OneToMany(() => CommunityInvite, (invite) => invite.community)
  @ApiProperty({ type: () => CommunityInvite, isArray: true })
  @Type(() => CommunityInvite)
  @IsDefined()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  internalInvites: Relation<CommunityInvite>[];
}
