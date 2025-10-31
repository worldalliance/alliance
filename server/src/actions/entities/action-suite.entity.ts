import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
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

@Entity()
export class ActionSuite {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @Allow()
  name: string;

  @OneToMany(() => Action, (action) => action.suite)
  @ApiProperty({ type: Action, isArray: true })
  @Allow()
  @Type(() => Action)
  actions: Action[];

  @OneToMany(() => ReminderGroup, (reminderGroup) => reminderGroup.actionSuite)
  @ApiProperty({ type: ReminderGroup, isArray: true })
  @Allow()
  @Type(() => ReminderGroup)
  reminderGroups: ReminderGroup[];

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

  @Expose()
  @ApiProperty({ type: ActionEvent, isArray: true })
  get events(): ActionEvent[] {
    return this.actions?.length
      ? this.actions[0].events.filter((event) => event.suiteManaged)
      : [];
  }
}
