import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { Allow, IsEmpty, IsOptional } from "class-validator";
import {
  CreateDateColumnTz,
  DeleteDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ActionEvent } from "./action-event.entity";
import { Action, parseAction, type ParsedAction } from "./action.entity";
import { GeneralUpdate } from "./general-update.entity";
import { ReminderGroup } from "./reminder-group.entity";

@Entity()
export class ActionSuite {
  // Fields

  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @Allow()
  name: string;

  @CreateDateColumnTz()
  @ApiProperty()
  @Type(() => Date)
  @Allow()
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty()
  @Type(() => Date)
  @Allow()
  updatedAt: Date;

  // Relations

  @OneToMany(() => Action, (action) => action.suite)
  @ApiPropertyOptional({ type: () => Action, isArray: true })
  @IsOptional()
  @Type(() => Action)
  actions?: Relation<Action>[];

  @ManyToMany(() => GeneralUpdate, (generalUpdate) => generalUpdate.suites)
  @ApiPropertyOptional({ type: () => GeneralUpdate, isArray: true })
  @IsOptional()
  @Type(() => GeneralUpdate)
  generalUpdates?: Relation<GeneralUpdate>[];

  @OneToMany(() => ReminderGroup, (reminderGroup) => reminderGroup.actionSuite)
  @ApiPropertyOptional({ type: () => ReminderGroup, isArray: true })
  @IsOptional()
  @Type(() => ReminderGroup)
  reminderGroups?: Relation<ReminderGroup>[];

  // Methods

  @Expose()
  @ApiProperty({ type: () => ActionEvent, isArray: true })
  get events(): ActionEvent[] {
    return this.actions?.length
      ? this.actions[0].events.filter((event) => event.suiteManaged)
      : [];
  }

  @DeleteDateColumnTz()
  @IsOptional()
  @IsEmpty()
  deletedAt: Date | null;
}

/**
 * An ActionSuite whose loaded actions have been parsed. Produce with {@link
 * parseActionSuite} immediately after pulling a suite from the db, so the
 * parse happens exactly once and everything downstream works with typed
 * expressions.
 */
export interface ParsedActionSuite extends ActionSuite {
  actions: ParsedAction[];
}

export function parseActionSuite(suite: ActionSuite): ParsedActionSuite {
  return Object.assign(suite, {
    actions: loadedActionSuiteActions(suite).map(parseAction),
  });
}

export function loadedActionSuiteActions(
  suite: ActionSuite,
): Relation<Action>[] {
  if (!suite.actions) {
    throw new Error(`actions of action suite ${suite.id} not loaded`);
  }
  return suite.actions;
}
