import { ApiProperty } from "@nestjs/swagger";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/**
 * A referral owner that is not a user account — e.g. a marketing campaign, a
 * partner org, a QR code at an event. Mirrors a user as a referral source: it
 * has its own bare signup `code` and can own share links (see ShareUrl). New
 * users who sign up via a campaign are attributed to it as a source
 * (`User.referredByCampaign`) rather than to a referring user.
 */
@Entity()
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

  @CreateDateColumnTz()
  @ApiProperty({ type: Date })
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty({ type: Date })
  updatedAt: Date;
}
