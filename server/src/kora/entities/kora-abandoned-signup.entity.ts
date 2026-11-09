import { OAuthProvider } from "@alliance/common/oauth";
import { ApiProperty } from "@nestjs/swagger";
import { OtpChannel } from "src/otp/otp-copy";
import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/** A verified contact whose signup ended before it gave a name. */
@Entity()
@Index(["channel", "destination"], { unique: true })
export class KoraAbandonedSignup {
  @PrimaryGeneratedColumn("uuid")
  @ApiProperty()
  id: string;

  @Column({ type: "enum", enum: OtpChannel, enumName: "OtpChannel" })
  @ApiProperty({ enum: OtpChannel, enumName: "OtpChannel" })
  channel: OtpChannel;

  @Column({ type: "citext" })
  @ApiProperty({ description: "The email address or E.164 mobile number" })
  destination: string;

  @Column({
    type: "enum",
    enum: OAuthProvider,
    enumName: "OAuthProvider",
    nullable: true,
  })
  @ApiProperty({
    enum: OAuthProvider,
    enumName: "OAuthProvider",
    nullable: true,
    description: "Set when a provider, not a code, verified the contact",
  })
  provider: OAuthProvider | null;

  /** The latest abandoned signup's verification. */
  @Column({ type: "timestamptz" })
  @ApiProperty({ type: Date })
  verifiedAt: Date;
}
