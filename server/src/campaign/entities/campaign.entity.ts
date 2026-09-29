import { ApiProperty } from "@nestjs/swagger";
import { Community } from "src/community/entities/community.entity";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

export enum CampaignKind {
  Campaign = "campaign",
  Organization = "organization",
}

/**
 * A referral owner that is not a user account — e.g. a marketing campaign, a
 * QR code at an event, or, with `kind` organization, a partner organization
 * that may own one accountability group. Mirrors a user as a referral source:
 * it has its own bare signup `code` and can own share links (see ShareUrl).
 * New users who sign up via a campaign are attributed to it as a source
 * (`User.referredByCampaign`) rather than to a referring user.
 */
@Entity()
@Check(
  "CHK_campaign_community_organization",
  `"communityId" IS NULL OR "kind" = 'organization'`,
)
export class Campaign {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column()
  @ApiProperty({
    description: "Human-readable label, shown in the admin panel",
  })
  name: string;

  @Index({ unique: true })
  @Column()
  @ApiProperty({
    description:
      "Bare signup referral code attributing new users to this campaign",
  })
  code: string;

  @Column({ type: "text", nullable: true })
  @ApiProperty({
    type: String,
    nullable: true,
    description: "Image key for the campaign avatar, shown on the signup page",
  })
  picture: string | null;

  @Column({ type: "enum", enum: CampaignKind, default: CampaignKind.Campaign })
  kind: CampaignKind;

  @Column({ nullable: true })
  communityId: number | null;

  @OneToOne(() => Community, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "communityId" })
  community?: Relation<Community> | null;

  @CreateDateColumnTz()
  @ApiProperty({ type: Date })
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty({ type: Date })
  updatedAt: Date;
}
