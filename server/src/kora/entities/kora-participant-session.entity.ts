import { CreateDateColumnTz } from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { KoraParticipant } from "./kora-participant.entity";

@Entity()
export class KoraParticipantSession {
  /** sha256 of the cookie's token. */
  @PrimaryColumn()
  tokenHash: string;

  @Index()
  @Column({ type: "uuid" })
  participantId: string;

  @ManyToOne(() => KoraParticipant, { onDelete: "CASCADE" })
  @JoinColumn({ name: "participantId" })
  participant?: Relation<KoraParticipant>;

  @Index()
  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @CreateDateColumnTz()
  createdAt: Date;
}
