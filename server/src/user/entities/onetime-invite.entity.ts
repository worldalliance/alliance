import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsEmpty, IsOptional } from "class-validator";
import { Campaign } from "src/campaign/entities/campaign.entity";
import { Community } from "src/community/entities/community.entity";
import { canModifyInvite } from "src/community/invite-permissions";
import {
  CreateDateColumnTz,
  DeleteDateColumnTz,
} from "src/datasources/basecolumns";
import { Notification } from "src/notifs/entities/notification.entity";
import type { Relation } from "src/utils/Repository";
import { WaitlistEntry } from "src/waitlist/entities/waitlist-entry.entity";
import {
  AfterInsert,
  AfterLoad,
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { User } from "./user.entity";

export enum OnetimeInviteStatus {
  REQUEST_PENDING = "request_pending",
  REQUEST_REJECTED = "request_rejected",
  LINK_UNUSED = "link_unused",
  LINK_USED = "link_used",
}

@Index(["createdAt", "id"])
@Check(
  "CHK_onetime_invite_issuer",
  `"invitingUserId" IS NULL OR "organizationId" IS NULL`,
)
@Entity()
export class OnetimeInvite {
  // Fields

  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @Allow()
  invitee: string;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  inviteeDescription: string | null;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  info: string | null;

  @ApiProperty()
  @Column()
  @Allow()
  code: string;

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @Column({
    type: "enum",
    enum: OnetimeInviteStatus,
  })
  @ApiProperty({
    enum: OnetimeInviteStatus,
    enumName: "OnetimeInviteStatus",
  })
  @Allow()
  status: OnetimeInviteStatus;

  @DeleteDateColumnTz()
  @ApiProperty({ type: Date, nullable: true })
  @Type(() => Date)
  @IsOptional()
  @IsEmpty()
  deletedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  @ApiProperty({ type: Date, nullable: true })
  @Type(() => Date)
  @IsOptional()
  usedAt: Date | null;

  // Relations

  @ManyToOne(() => User, {
    onDelete: "SET NULL",
  })
  @ApiPropertyOptional({ type: () => User, nullable: true })
  @Type(() => User)
  @JoinColumn({ name: "invitingUserId" })
  @IsOptional()
  invitingUser?: Relation<User> | null;

  @OneToOne(() => User, (user) => user.referredByInvite)
  @ApiPropertyOptional({ type: () => User, nullable: true })
  @Type(() => User)
  @IsOptional()
  invitedUser?: Relation<User> | null;

  @RelationId((invite: OnetimeInvite) => invite.invitedUser)
  @Type(() => Number)
  @ApiProperty({ type: Number, nullable: true })
  @IsOptional()
  invitedUserId: number | null;

  // TypeORM leaves an inverse-side @RelationId unset when no row matches.
  @AfterLoad()
  @AfterInsert()
  private nullInvitedUserId() {
    this.invitedUserId ??= null;
  }

  @ManyToOne(() => Community, (community) => community.invites, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @ApiPropertyOptional({ type: () => Community, nullable: true })
  @Type(() => Community)
  @JoinColumn({ name: "communityId" })
  @IsOptional()
  community?: Relation<Community> | null;

  @RelationId((invite: OnetimeInvite) => invite.community)
  @Type(() => Number)
  @ApiProperty({ type: Number, nullable: true })
  @IsOptional()
  communityId: number | null;

  @Column({ nullable: true })
  @IsOptional()
  organizationId: number | null;

  @ManyToOne(() => Campaign, { nullable: true })
  @JoinColumn({ name: "organizationId" })
  @IsOptional()
  organization?: Relation<Campaign> | null;

  @Index()
  @Column({ nullable: true })
  @IsOptional()
  waitlistEntryId: number | null;

  @ManyToOne(() => WaitlistEntry, { nullable: true })
  @JoinColumn({ name: "waitlistEntryId" })
  @IsOptional()
  waitlistEntry?: Relation<WaitlistEntry> | null;

  @OneToMany(() => Notification, (notif) => notif.onetimeInvite)
  @Type(() => Notification)
  @ApiPropertyOptional({ type: () => Notification, isArray: true })
  @IsOptional()
  notifs?: Relation<Notification>[];
}

export function loadedOnetimeInviteInvitingUser(
  invite: OnetimeInvite,
): Relation<User> | null {
  if (invite.invitingUser === undefined) {
    throw new Error(`invitingUser of onetime invite ${invite.id} not loaded`);
  }
  return invite.invitingUser;
}

export function canModifyOnetimeInvite(
  user: Pick<User, "id" | "admin" | "leaderOfIdSet">,
  invite: OnetimeInvite,
): boolean {
  return canModifyInvite(user, {
    invitingUserId: loadedOnetimeInviteInvitingUser(invite)?.id ?? null,
    communityId: invite.communityId,
  });
}
