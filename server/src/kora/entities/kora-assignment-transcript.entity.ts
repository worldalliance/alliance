import { KoraReviewStatus } from "@alliance/common/kora";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { KoraAssignment } from "./kora-assignment.entity";
import { KoraTranscript } from "./kora-transcript.entity";

/** One transcript in an assignment, with its status as of the latest export. */
@Entity()
@Index(["transcriptId", "status"])
export class KoraAssignmentTranscript {
  @PrimaryColumn({ type: "uuid" })
  assignmentId: string;

  @ManyToOne(() => KoraAssignment, { onDelete: "CASCADE" })
  @JoinColumn({ name: "assignmentId" })
  assignment?: Relation<KoraAssignment>;

  @PrimaryColumn({ type: "varchar" })
  transcriptId: string;

  @ManyToOne(() => KoraTranscript, { onDelete: "CASCADE" })
  @JoinColumn({ name: "transcriptId" })
  transcript?: Relation<KoraTranscript>;

  @Column({ type: "int" })
  position: number;

  @Column({
    type: "enum",
    enum: KoraReviewStatus,
    enumName: "KoraReviewStatus",
    default: KoraReviewStatus.Pending,
  })
  status: KoraReviewStatus;
}
