// src/forms/form-response.entity.ts
import type { DeviceVisibilityTarget } from "@alliance/common/forms/device";
import {
  readVisibilityValidatorResults,
  type VisibilityValidatorResults,
} from "@alliance/common/forms/visibility";
import { R } from "@alliance/common/result";
import { Logger } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsDefined, IsOptional } from "class-validator";
import { Guest } from "src/auth/entities/guest.entity";
import { CreateDateColumnTz } from "src/datasources/basecolumns";
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
  @IsDefined()
  @Type(() => Form)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  form: Relation<Form>;

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

  @Column({ type: "text", nullable: true })
  @ApiPropertyOptional({ type: "string" })
  @IsOptional()
  @Type(() => String)
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  deviceType?: DeviceVisibilityTarget;

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
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => String)
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  sessionReplayUrl?: string;

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  phDistinctId?: string;

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
  @ApiPropertyOptional({ type: "string" })
  @IsOptional()
  @Type(() => String)
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  sid?: string;
}

/**
 * A FormResponse whose jsonb columns have been parsed. Produce with {@link
 * parseFormResponse} immediately after pulling one from the db, so the parse
 * happens exactly once and everything downstream works with a typed value.
 */
export interface ParsedFormResponse extends FormResponse {
  visibilityValidatorResults: VisibilityValidatorResults;
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
  // Mutate-and-cast (rather than spread) to keep the entity's prototype; the
  // assignment above set the only field the cast narrows.
  return response as ParsedFormResponse;
}
