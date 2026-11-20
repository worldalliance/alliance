import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

/** One per number with a text opt-out state. */
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
