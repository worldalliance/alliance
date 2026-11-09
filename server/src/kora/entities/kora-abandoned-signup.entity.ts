import { OAuthProvider } from "@alliance/common/oauth";
import { OtpChannel } from "src/otp/otp-copy";
import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/** A verified contact whose signup ended before it gave a name. */
@Entity()
@Index(["channel", "destination"], { unique: true })
export class KoraAbandonedSignup {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "enum", enum: OtpChannel, enumName: "OtpChannel" })
  channel: OtpChannel;

  @Column({ type: "citext" })
  destination: string;

  /** Set when a provider, not a code, verified the contact. */
  @Column({
    type: "enum",
    enum: OAuthProvider,
    enumName: "OAuthProvider",
    nullable: true,
  })
  provider: OAuthProvider | null;

  /** The latest abandoned signup's verification. */
  @Column({ type: "timestamptz" })
  verifiedAt: Date;
}
