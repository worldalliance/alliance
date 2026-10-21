import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsInt, IsOptional } from "class-validator";
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
import { Form } from "./form.entity";

// The row of a form's row list a member holds. `rowKey` is `rowKey(row,
// keyFields)`, so an edit to a row's other fields still reaches its holders.
@Entity()
@Index("UQ_form_row_assignment_formId_userId", ["formId", "userId"], {
  unique: true,
})
@Index("IDX_form_row_assignment_formId_rowKey", ["formId", "rowKey"])
export class FormRowAssignment {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @IsInt()
  formId: number;

  @ManyToOne(() => Form, { onDelete: "CASCADE" })
  @JoinColumn({ name: "formId" })
  @Type(() => Form)
  @IsOptional()
  form?: Relation<Form>;

  @Column()
  @ApiProperty()
  @IsInt()
  userId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  @Type(() => User)
  @IsOptional()
  user?: Relation<User>;

  @Column({ type: "text" })
  @ApiProperty()
  @Allow()
  rowKey: string;

  // Not a create-date column: reassigning a removed row restarts it.
  @Column({ type: "timestamptz", default: () => "now()" })
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  assignedAt: Date;
}
