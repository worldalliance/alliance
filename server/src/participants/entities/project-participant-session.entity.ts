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
import { ProjectParticipant } from "./project-participant.entity";

@Entity()
export class ProjectParticipantSession {
  /** sha256 of the cookie's token. */
  @PrimaryColumn()
  tokenHash: string;

  @Index()
  @Column({ type: "uuid" })
  participantId: string;

  @ManyToOne(() => ProjectParticipant, { onDelete: "CASCADE" })
  @JoinColumn({ name: "participantId" })
  participant?: Relation<ProjectParticipant>;

  @Index()
  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @CreateDateColumnTz()
  createdAt: Date;
}
