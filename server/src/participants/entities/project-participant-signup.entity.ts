import { CreateDateColumnTz } from "src/datasources/basecolumns";
import { OtpChannel } from "src/otp/otp-copy";
import { Column, Entity, Index, PrimaryColumn } from "typeorm";

/** A verified contact waiting on a name before it becomes a participant. */
@Entity()
export class ProjectParticipantSignup {
  /** sha256 of the cookie's token. */
  @PrimaryColumn()
  tokenHash: string;

  @Column({ type: "enum", enum: OtpChannel, enumName: "OtpChannel" })
  channel: OtpChannel;

  @Column({ type: "citext" })
  destination: string;

  @Index()
  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @CreateDateColumnTz()
  createdAt: Date;
}
