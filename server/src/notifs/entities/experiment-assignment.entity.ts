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

export enum Experiment {
  MissedSuiteFirstNotice = "missed_suite_first_notice",
  /** Variant completers read branch A of `RecognitionBranch`; everyone else, branch B. */
  ActionUpdateRecognition = "action_update_recognition",
}

export enum ExperimentArm {
  Control = "control",
  Variant = "variant",
}

/** A member's arm in an experiment, drawn once and kept for good. */
@Entity()
@Index(["userId", "experiment"], { unique: true })
export class ExperimentAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user?: Relation<User>;

  @Column()
  userId: number;

  @Column({ type: "enum", enum: Experiment, enumName: "Experiment" })
  experiment: Experiment;

  @Column({ type: "enum", enum: ExperimentArm, enumName: "ExperimentArm" })
  arm: ExperimentArm;

  @CreateDateColumnTz()
  createdAt: Date;
}
