import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

/** Written on a number's inbound text, staff text or opt-out change, member
 * or not. */
@Entity()
export class MmsThread {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    unique: true,
    comment: "As mms.memberPhoneNumber holds it, so it may be a short code",
  })
  phoneNumber: string;

  /** Null until a STOP, START or staff opt-out sets it. Readers also count
   * the user flag: see optedOutSql. */
  @Column({ type: "boolean", nullable: true })
  optedOut: boolean | null;

  @CreateDateColumnTz()
  createdAt: Date;

  @UpdateDateColumnTz()
  updatedAt: Date;
}
