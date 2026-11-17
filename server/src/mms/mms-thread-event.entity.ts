import type { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { CreateDateColumnTz } from "../datasources/basecolumns";
import { Mms } from "./mms.entity";

export enum MmsThreadEventKind {
  MarkedHandled = "marked_handled",
  MarkedNeedsReply = "marked_needs_reply",
}

/** A staff action on a member's thread, kept as history: rows are only
 * inserted, so an undo is a later row rather than an edit, and never deleted,
 * so deleting a text an event follows is refused. */
@Entity()
export class MmsThreadEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "enum", enum: MmsThreadEventKind })
  kind: MmsThreadEventKind;

  @ManyToOne(() => Mms, (mms) => mms.threadEvents, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "afterMmsId" })
  afterMms?: Relation<Mms>;

  @Index()
  @Column({
    comment: "The newest text staff could see, which the event follows",
  })
  afterMmsId: number;

  // Named by string for the reason on Mms.sentBy.
  @ManyToOne("User", { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "markedById" })
  markedBy?: Relation<Pick<User, "name">> | null;

  @Column({ type: "int", nullable: true })
  markedById: number | null;

  @CreateDateColumnTz()
  createdAt: Date;
}
