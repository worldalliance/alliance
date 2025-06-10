import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { UserAction, UserActionRelation } from './user-action.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNotEmpty } from 'class-validator';
import { ActionEvent, ActionStatus } from './action-event.entity';

export enum ActionTaskType {
  Funding = 'Funding', //giving money to a particular cause
  Activity = 'Activity', // one-time action taking a limited amount of time
  Ongoing = 'Ongoing', // ongoing or recurring behavior change
}

@Entity()
export class Action {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier for the action' })
  id: number;

  @Column()
  @ApiProperty({ description: 'Name of the action' })
  @IsNotEmpty()
  name: string;

  @Column()
  @ApiProperty({ description: 'Category of the action' })
  category: string;

  @Column()
  @ApiProperty({ description: 'Reason to join the action' })
  whyJoin: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Image URL for the action', nullable: true })
  image: string;

  @Column()
  @ApiProperty({ description: 'Description of the action' })
  @IsNotEmpty()
  description: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Short description shown in cards' })
  shortDescription: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Steps to complete the action' })
  howTo: string;

  @Column({ nullable: true })
  @ApiProperty()
  timeEstimate: string;

  @Column()
  @ApiProperty({
    description: 'Current status of the action',
    enum: ActionStatus,
  })
  @IsNotEmpty()
  status: ActionStatus;

  @Column({ default: ActionTaskType.Activity })
  @ApiProperty({
    description: 'Type of the action',
    enum: ActionTaskType,
  })
  @IsNotEmpty()
  type: ActionTaskType;

  @CreateDateColumn()
  @ApiProperty({ description: 'Timestamp when the action was created' })
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Timestamp when the action was last updated' })
  updatedAt: Date;

  @OneToMany(() => UserAction, (userAction) => userAction.action)
  @ApiProperty({
    description: 'Relations between users and the action',
    type: () => [UserAction],
  })
  userRelations: UserAction[];

  @OneToMany(() => ActionEvent, (event) => event.action)
  @ApiProperty({
    description: 'Events associated with the action',
    type: () => [ActionEvent],
  })
  events: ActionEvent[];

  @Expose()
  @ApiProperty({
    description: 'Number of users who have joined the action',
    example: 5,
  })
  get usersJoined(): number {
    return (
      this.userRelations?.filter(
        (ur) =>
          ur.status === UserActionRelation.joined ||
          ur.status === UserActionRelation.completed,
      ).length || 0
    );
  }

  @Expose()
  @ApiProperty({
    description: 'Number of users who have completed the action',
    example: 5,
  })
  get usersCompleted(): number {
    return (
      this.userRelations?.filter(
        (ur) => ur.status === UserActionRelation.completed,
      ).length || 0
    );
  }
}
