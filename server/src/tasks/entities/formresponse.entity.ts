// src/forms/form-response.entity.ts
import type { DeviceVisibilityTarget } from "@alliance/common/forms/device";
import {
  readFormulaChoices,
  type FormulaChoices,
} from "@alliance/common/forms/formula-options";
import {
  readVisibilityValidatorResults,
  type VisibilityValidatorResults,
} from "@alliance/common/forms/visibility";
import { R } from "@alliance/common/result";
import { Logger } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsDefined, IsEmpty, IsOptional } from "class-validator";
import { Guest } from "src/auth/entities/guest.entity";
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
import { Form } from "./form.entity";
import { FormSnapshot } from "./formsnapshot.entity";

const logger = new Logger("FormResponse");

@Entity()
@Index(["user", "formId"])
@Check(`NOT ("userId" IS NOT NULL AND "guestId" IS NOT NULL)`)
export class FormResponse {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @IsDefined()
  formId: number;

  @ManyToOne(() => Form, (f) => f.responses, { onDelete: "CASCADE" })
  @IsOptional()
  @Type(() => Form)
  form?: Relation<Form>;

  @Column({ type: "jsonb" })
  @ApiProperty()
  @IsDefined()
  @Type(() => Object)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answers: Record<string, any>;

  @Column({ type: "jsonb", default: () => "'{}'" })
  @ApiProperty({ type: Object })
  @IsOptional()
  visibilityValidatorResults: unknown;

  @Column({ type: "jsonb", default: () => "'{}'" })
  @ApiProperty()
  @Allow()
  @Type(() => Object)
  publicAnswers: Record<string, boolean>;

  /** Read with `readFormulaChoices`. */
  @Column({ type: "jsonb", default: () => "'{}'" })
  @ApiProperty({ type: Object })
  @IsOptional()
  formulaChoices: unknown;

  @Column({ type: "text", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @Type(() => String)
  deviceType: DeviceVisibilityTarget | null;

  @ApiPropertyOptional({ type: () => User })
  @ManyToOne(() => User, { onDelete: "CASCADE", nullable: true })
  @IsOptional()
  @Type(() => User)
  user?: Relation<User>;

  @ApiPropertyOptional({ type: () => Guest })
  @ManyToOne(() => Guest, { onDelete: "CASCADE", nullable: true })
  @IsOptional()
  @Type(() => Guest)
  guest?: Relation<Guest>;

  @Column({ type: "text", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @Type(() => String)
  sessionReplayUrl: string | null;

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  phDistinctId: string | null;

  @Column()
  @ApiProperty()
  @Allow()
  formSnapshotId: number;

  @ManyToOne(() => FormSnapshot, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "formSnapshotId" })
  @Type(() => FormSnapshot)
  @Allow()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  formSnapshot: Relation<FormSnapshot>;

  @Column({ type: "text", nullable: true })
  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @Type(() => String)
  sid: string | null;

  @DeleteDateColumnTz()
  @IsOptional()
  @IsEmpty()
  deletedAt: Date | null;
}

/**
 * A FormResponse whose jsonb columns have been parsed. Produce with {@link
 * parseFormResponse} immediately after pulling one from the db, so the parse
 * happens exactly once and everything downstream works with a typed value.
 */
export interface ParsedFormResponse extends FormResponse {
  visibilityValidatorResults: VisibilityValidatorResults;
  formulaChoices: FormulaChoices;
}

export function parseFormResponse(response: FormResponse): ParsedFormResponse {
  // A row written before the submission boundary validated this column isn't
  // worth failing a whole feed over: drop what won't read, and log it.
  const verdicts: VisibilityValidatorResults = R.match(
    readVisibilityValidatorResults(response.visibilityValidatorResults),
    {
      success: ({ verdicts, unreadable }) => {
        if (unreadable.length > 0) {
          logger.error(
            `Form response ${response.id}: dropped unreadable visibility validator verdicts ${unreadable.join(", ")}`,
          );
        }
        return verdicts;
      },
      failure: () => {
        logger.error(
          `Form response ${response.id}: visibility validator results are not an object`,
        );
        return {};
      },
    },
  );
  response.visibilityValidatorResults = verdicts;
  response.formulaChoices = R.unwrapOrElse(
    readFormulaChoices(response.formulaChoices),
    () => {
      logger.error(
        `Form response ${response.id}: formula choices are unreadable`,
      );
      return {};
    },
  );
  // Mutate-and-cast (rather than spread) to keep the entity's prototype; the
  // assignments above set the only fields the cast narrows.
  return response as ParsedFormResponse;
}
