import {
  Column,
  Entity,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Action } from './action.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { Expose, Type } from 'class-transformer';
import { ReminderGroup } from './reminder-group.entity';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import { ActionEvent } from './action-event.entity';
import type { Relation } from 'src/utils/Repository';
import { GeneralUpdate } from './general-update.entity';

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
