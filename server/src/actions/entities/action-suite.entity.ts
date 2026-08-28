import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { Allow } from "class-validator";
import {
  CreateDateColumnTz,
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
  @ApiProperty({ type: () => Action, isArray: true })
  @Allow()
  @Type(() => Action)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  actions: Relation<Action>[];

  @ManyToMany(() => GeneralUpdate, (generalUpdate) => generalUpdate.suites)
  @ApiProperty({ type: () => GeneralUpdate, isArray: true })
  @Allow()
  @Type(() => GeneralUpdate)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  generalUpdates: Relation<GeneralUpdate>[];

  @OneToMany(() => ReminderGroup, (reminderGroup) => reminderGroup.actionSuite)
  @ApiProperty({ type: () => ReminderGroup, isArray: true })
  @Allow()
  @Type(() => ReminderGroup)
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  reminderGroups: Relation<ReminderGroup>[];

  // Methods

  @Expose()
  @ApiProperty({ type: () => ActionEvent, isArray: true })
  get events(): ActionEvent[] {
    return this.actions?.length
      ? this.actions[0].events.filter((event) => event.suiteManaged)
      : [];
  }
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
  suite.actions = suite.actions?.map(parseAction);
  return suite as ParsedActionSuite;
}
