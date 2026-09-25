import { ApiProperty } from "@nestjs/swagger";
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
import { ActionCohortDecision } from "./action-cohort-decision.entity";
import { CohortDecisionReason } from "./cohort-decision-reason";

/** The values a staff correction replaced, and why staff replaced them. */
@Entity()
@Index("IDX_action_cohort_decision_correction_decisionId", ["decisionId"])
export class ActionCohortDecisionCorrection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  decisionId: number;

  @ManyToOne(() => ActionCohortDecision, (decision) => decision.corrections, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "decisionId" })
  decision?: Relation<ActionCohortDecision>;

  @ApiProperty()
  @Column()
  previousIncluded: boolean;

  @ApiProperty({ enum: CohortDecisionReason, enumName: "CohortDecisionReason" })
  @Column({ type: "enum", enum: CohortDecisionReason })
  previousReason: CohortDecisionReason;

  @ApiProperty({ type: Date })
  @Column({ type: "timestamptz" })
  previousResolvedAt: Date;

  @ApiProperty()
  @Column({ type: "text" })
  note: string;

  @Column({ type: "int", nullable: true })
  correctedById: number | null;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "correctedById" })
  correctedBy?: Relation<User> | null;

  @ApiProperty({ type: Date })
  @CreateDateColumnTz()
  correctedAt: Date;
}
