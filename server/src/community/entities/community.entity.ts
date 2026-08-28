import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
} from "@alliance/common/community";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  Allow,
  IsBoolean,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import { OnetimeInvite } from "src/user/entities/onetime-invite.entity";
import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import { trim } from "src/utils/transforms";
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
  @ApiProperty({ maxLength: COMMUNITY_NAME_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMUNITY_NAME_MAX_LENGTH)
  name: string;

  @Column({ default: "" })
  @ApiProperty({ maxLength: COMMUNITY_DESCRIPTION_MAX_LENGTH })
  @IsString()
  @MaxLength(COMMUNITY_DESCRIPTION_MAX_LENGTH)
  description: string;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  photo: string | null;

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
  @IsBoolean()
  public: boolean;

  @Column({ default: true })
  @ApiProperty()
  @IsBoolean()
  allowMemberInvites: boolean;

  @Column({ default: true })
  @ApiProperty()
  @IsBoolean()
  allowStaffAssignments: boolean;

  @Column({ type: "int", nullable: true, default: 10 })
  @ApiProperty({ type: Number, nullable: true, default: 10 })
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
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
