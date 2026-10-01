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
import { WaitlistEntry } from "./waitlist-entry.entity";

export enum WaitlistEntryActionKind {
  ManualMobilize = "manual_mobilize",
  UndoMobilize = "undo_mobilize",
  EmailMobilize = "email_mobilize",
}

/** A staff change to an entry's status, recorded only when it changed. */
@Entity()
export class WaitlistEntryAction {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  entryId: number;

  @ManyToOne(() => WaitlistEntry)
  @JoinColumn({ name: "entryId" })
  entry?: Relation<WaitlistEntry>;

  @Column({ type: "enum", enum: WaitlistEntryActionKind })
  kind: WaitlistEntryActionKind;

  @Column({ nullable: true })
  staffUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "staffUserId" })
  staffUser?: Relation<User> | null;

  @CreateDateColumnTz()
  createdAt: Date;
}
