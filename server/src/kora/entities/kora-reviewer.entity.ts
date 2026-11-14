import {
  CreateDateColumnTz,
  DeleteDateColumnTz,
} from "src/datasources/basecolumns";
import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { KoraParticipant } from "./kora-participant.entity";

/**
 * The opaque reviewer the review tool and KORA see: one per member and one per
 * participant, never linked to each other.
 */
@Entity()
@Check(`num_nonnulls("participantId", "userId") = 1`)
export class KoraReviewer {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index({ unique: true })
  @Column({ type: "uuid", nullable: true })
  participantId: string | null;

  @ManyToOne(() => KoraParticipant, { onDelete: "CASCADE" })
  @JoinColumn({ name: "participantId" })
  participant?: Relation<KoraParticipant>;

  @Index({ unique: true })
  @Column({ type: "int", nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user?: Relation<User>;

  /** Set by the first export that answers the profile, after which the tool stops asking. */
  @Column({ type: "timestamptz", nullable: true })
  profileAnsweredAt: Date | null;

  /** When the reviewer was last told more reviews are ready; resent after each newer batch. */
  @Column({ type: "timestamptz", nullable: true })
  moreNotifiedAt: Date | null;

  @CreateDateColumnTz()
  createdAt: Date;

  @DeleteDateColumnTz()
  deletedAt: Date | null;
}
