import { CreateDateColumnTz } from "src/datasources/basecolumns";
import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { OtpChannel, OtpPurpose } from "./otp-copy";

/**
 * A code awaiting use. Using or replacing it deletes the row; expired ones
 * linger until the hourly purge, so reads filter on expiry and attempts.
 */
@Entity()
@Index(["purpose", "destination"])
export class OtpChallenge {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "enum", enum: OtpPurpose, enumName: "OtpPurpose" })
  purpose: OtpPurpose;

  @Column({ type: "enum", enum: OtpChannel, enumName: "OtpChannel" })
  channel: OtpChannel;

  /** A normalized email address or E.164 number. */
  @Column({ type: "citext" })
  destination: string;

  /** sha256 of the token in the initiating browser's cookie. */
  @Index({ unique: true })
  @Column()
  browserTokenHash: string;

  @Column()
  codeDigest: string;

  @Column({ default: 0 })
  wrongAttempts: number;

  @Index()
  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @CreateDateColumnTz()
  createdAt: Date;
}
