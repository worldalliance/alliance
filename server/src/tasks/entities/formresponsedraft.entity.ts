import {
  readFormAnswers,
  type FormAnswers,
} from "@alliance/common/forms/form-responses";
import { R } from "@alliance/common/result";
import { Logger } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsDefined, IsOptional } from "class-validator";
import { User } from "src/user/entities/user.entity";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Form } from "./form.entity";

const logger = new Logger("FormResponseDraft");

/**
 * In-progress answers to a task form, saved so a member can carry a form
 * across devices. A draft is never a submission: it has no ActionActivity, so
 * completion counts, feeds and reminders don't see it, and it is deleted once
 * the form is submitted or withdrawn from.
 */
@Entity()
@Unique(["userId", "formId"])
export class FormResponseDraft {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @Allow()
  userId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  @Type(() => User)
  @IsOptional()
  user?: Relation<User>;

  @Column()
  @ApiProperty()
  @IsDefined()
  formId: number;

  @ManyToOne(() => Form, { onDelete: "CASCADE" })
  @JoinColumn({ name: "formId" })
  @Type(() => Form)
  @IsOptional()
  form?: Relation<Form>;

  @Column()
  @ApiProperty()
  @IsDefined()
  actionId: number;

  @Column()
  @ApiProperty()
  @IsDefined()
  formSnapshotId: number;

  @Column({ type: "jsonb" })
  @ApiProperty({ type: Object })
  @IsOptional()
  @Type(() => Object)
  answers: unknown;

  @Column({ type: "jsonb", default: () => "'{}'" })
  @ApiProperty({ type: Object })
  @Allow()
  @Type(() => Object)
  publicAnswers: Record<string, boolean>;

  @Column({ type: "int", default: 0 })
  @ApiProperty()
  @Allow()
  currentPageIndex: number;

  /**
   * Written by the service rather than TypeORM: the save is an upsert, and
   * `@UpdateDateColumn` only fires on the update path.
   */
  @Column({ type: "timestamptz" })
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  updatedAt: Date;
}

export interface ParsedFormResponseDraft extends FormResponseDraft {
  answers: FormAnswers;
}

/**
 * Reads a stored draft, or null when its answers no longer parse. A draft is
 * a convenience copy, so dropping one costs the member their cross-device
 * progress, where failing the request would cost them the form.
 */
export function parseFormResponseDraft(
  draft: FormResponseDraft,
): ParsedFormResponseDraft | null {
  const answers = readFormAnswers(draft.answers);
  if (R.isFailure(answers)) {
    logger.error(`Form response draft ${draft.id}: answers are unreadable`);
    return null;
  }
  draft.answers = answers.value;
  // Mutate-and-cast (rather than spread) to keep the entity's prototype; the
  // assignment above set the only field the cast narrows.
  return draft as ParsedFormResponseDraft;
}
