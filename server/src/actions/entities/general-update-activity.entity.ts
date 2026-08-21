import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow } from "class-validator";
import { CreateDateColumnTz } from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";
import { GeneralUpdate } from "./general-update.entity";

export enum GeneralUpdateActivityType {
  DISMISSED = "dismissed",
}

@Entity()
export class GeneralUpdateActivity {
  // Fields

  @PrimaryGeneratedColumn()
  @Allow()
  @ApiProperty()
  id: number;

  @Column({ type: "enum", enum: GeneralUpdateActivityType })
  @ApiProperty({
    description: "Type of general update activity",
    enum: GeneralUpdateActivityType,
    enumName: "GeneralUpdateActivityType",
  })
  @Allow()
  type: GeneralUpdateActivityType;

  @CreateDateColumnTz()
  @Allow()
  @Type(() => Date)
  @ApiProperty()
  createdAt: Date;

  // Relations

  @ManyToOne(() => GeneralUpdate, { onDelete: "CASCADE" })
  @JoinColumn({ name: "generalUpdateId" })
  @Allow()
  @Type(() => GeneralUpdate)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  generalUpdate: Relation<GeneralUpdate>;

  @Column()
  @ApiProperty()
  @Allow()
  generalUpdateId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  @Allow()
  @Type(() => User)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  user: Relation<User>;

  @Column()
  @Allow()
  @ApiProperty()
  userId: number;
}
