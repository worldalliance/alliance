import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Mms } from "./mms.entity";

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

  @ManyToOne(() => Mms, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "launchCutoffId" })
  launchCutoff?: Relation<Mms> | null;

  @Column({
    type: "int",
    nullable: true,
    comment:
      "Needs reply skips inbound texts up to this one: the newest when per-number threads launched, set only if no live member held the number",
  })
  launchCutoffId: number | null;

  @CreateDateColumnTz()
  createdAt: Date;

  @UpdateDateColumnTz()
  updatedAt: Date;
}
