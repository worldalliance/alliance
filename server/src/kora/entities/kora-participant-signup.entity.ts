import { OAuthProvider } from "@alliance/common/oauth";
import { CreateDateColumnTz } from "src/datasources/basecolumns";
import { OtpChannel } from "src/otp/otp-copy";
import { Check, Column, Entity, Index, PrimaryColumn } from "typeorm";

/** A verified contact waiting on a name before it becomes a participant. */
@Entity()
@Check(
  "CHK_kora_participant_signup_identity",
  `("provider" IS NULL) = ("subject" IS NULL)`,
)
export class KoraParticipantSignup {
  /** sha256 of the cookie's token. */
  @PrimaryColumn()
  tokenHash: string;

  @Column({ type: "enum", enum: OtpChannel, enumName: "OtpChannel" })
  channel: OtpChannel;

  @Column({ type: "citext" })
  destination: string;

  /** Set when a provider verified the contact, to connect once signed up. */
  @Column({
    type: "enum",
    enum: OAuthProvider,
    enumName: "OAuthProvider",
    nullable: true,
  })
  provider: OAuthProvider | null;

  @Column({ type: "varchar", nullable: true })
  subject: string | null;

  @Index()
  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @CreateDateColumnTz()
  createdAt: Date;
}
