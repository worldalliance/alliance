import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsOptional } from "class-validator";
import { Contract } from "src/contract/entities/contract.entity";
import { UpdateDateColumnTz } from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { User } from "./user.entity";

export enum ContractEventType {
  SIGNED = "signed",
  SUSPENDED = "suspended",
}

type ContractEventOrderFields = Pick<ContractEvent, "date" | "id">;

export function compareContractEventsNewestFirst<
  T extends ContractEventOrderFields,
>(a: T, b: T): number {
  return b.date.getTime() - a.date.getTime() || b.id - a.id;
}

export function getEffectiveContractEventsInRange<
  T extends ContractEventOrderFields,
>(events: readonly T[], startTime: number, endTime: number): T[] {
  const effectiveByTime = new Map<number, T>();

  for (const event of events) {
    const eventTime = event.date.getTime();
    if (eventTime < startTime || eventTime >= endTime) continue;

    const existing = effectiveByTime.get(eventTime);
    if (!existing || compareContractEventsNewestFirst(event, existing) < 0) {
      effectiveByTime.set(eventTime, event);
    }
  }

  return Array.from(effectiveByTime.values());
}

@Entity()
@Index(["user", "date"])
@Unique(["user", "autoSuspendKey"])
@Check(`"type" != 'signed' OR "contractId" IS NOT NULL`)
export class ContractEvent {
  // Fields

  @PrimaryGeneratedColumn()
  @Allow()
  id: number;

  @Column({ type: "enum", enum: ContractEventType })
  @ApiProperty({ enum: ContractEventType, enumName: "ContractEventType" })
  @Allow()
  type: ContractEventType;

  @Column({ type: "timestamptz" })
  @ApiProperty()
  @Type(() => Date)
  @Allow()
  date: Date;

  @UpdateDateColumnTz()
  @Type(() => Date)
  @Allow()
  updatedAt: Date;

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  automatic: boolean;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ type: "string", nullable: true })
  @IsOptional()
  autoSuspendKey: string | null;

  @Column({ type: "varchar", nullable: true })
  @ApiProperty({ type: "string", nullable: true })
  @IsOptional()
  signedName: string | null;

  @Column({ type: "int", nullable: true })
  @ApiProperty({ nullable: true })
  @IsOptional()
  contractId: number | null;

  // Relations

  @ManyToOne(() => User, (user) => user.contractEvents, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @Allow()
  @Type(() => User)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  user: Relation<User>;

  @ManyToOne(() => Contract, (contract) => contract.events, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "contractId" })
  @ApiPropertyOptional({
    type: () => Contract,
    nullable: true,
  })
  @Type(() => Contract)
  @IsOptional()
  contract?: Relation<Contract>;
}
