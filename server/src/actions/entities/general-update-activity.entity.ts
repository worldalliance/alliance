import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsEmpty, IsOptional } from "class-validator";
import {
  CreateDateColumnTz,
  DeleteDateColumnTz,
} from "src/datasources/basecolumns";
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
  @IsOptional()
  @Type(() => GeneralUpdate)
  generalUpdate?: Relation<GeneralUpdate>;

  @Column()
  @ApiProperty()
  @Allow()
  generalUpdateId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  @IsOptional()
  @Type(() => User)
  user?: Relation<User>;

  @Column()
  @Allow()
  @ApiProperty()
  userId: number;

  @DeleteDateColumnTz()
  @IsOptional()
  @IsEmpty()
  deletedAt: Date | null;
}
