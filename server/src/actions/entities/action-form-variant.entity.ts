import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsInt, IsNumber, IsString, Max, Min } from "class-validator";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import { Form } from "src/tasks/entities/form.entity";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Action } from "./action.entity";

@Entity()
@Index("IDX_action_form_variant_actionId", ["actionId"])
@Unique("UQ_action_form_variant_formId", ["formId"])
export class ActionFormVariant {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @IsInt()
  actionId: number;

  @ManyToOne(() => Action, { onDelete: "CASCADE" })
  @JoinColumn({ name: "actionId" })
  @Type(() => Action)
  @Allow()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  action: Relation<Action>;

  @Column()
  @ApiProperty()
  @IsInt()
  formId: number;

  @ManyToOne(() => Form, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "formId" })
  @Type(() => Form)
  @Allow()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  form: Relation<Form>;

  @Column({ type: "text" })
  @ApiProperty()
  @IsString()
  name: string;

  @Column({ type: "double precision" })
  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(1)
  splitValue: number;

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  updatedAt: Date;
}
