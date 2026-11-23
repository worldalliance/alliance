import { CreateDateColumnTz } from "src/datasources/basecolumns";
import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { OtpChannel, OtpPurpose } from "./otp-copy";

/**
 * A code awaiting use. Using or replacing it deletes the row; expired ones
 * linger until the hourly purge, so reads filter on expiry and attempts.
 */
@Entity()
@Index(["purpose", "destination", "userId"])
export class OtpChallenge {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "enum", enum: OtpPurpose, enumName: "OtpPurpose" })
  purpose: OtpPurpose;

  @Column({ type: "enum", enum: OtpChannel, enumName: "OtpChannel" })
  channel: OtpChannel;

  /** The account that asked, which alone may use the code; null for KORA sign-in. */
  @Column({ type: "int", nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user?: Relation<User>;

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
