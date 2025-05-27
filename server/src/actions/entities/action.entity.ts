import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  JoinTable,
  CreateDateColumn,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { UserAction, UserActionRelation } from './user-action.entity';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNotEmpty } from 'class-validator';
import { ActionEvent } from './action-event.entity';

export enum ActionStatus {
  Active = 'active',
  Upcoming = 'upcoming',
  Past = 'past',
  Draft = 'draft',
}

@Entity()
export class Action {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column()
  @ApiProperty()
  @IsNotEmpty()
  name: string;

  @Column()
  @ApiProperty()
  category: string;

  @Column()
  @ApiProperty()
  whyJoin: string;

  @Column({ nullable: true })
  @ApiProperty()
  image: string;

  @Column()
  @ApiProperty()
  @IsNotEmpty()
  description: string;

  @Column({ nullable: true })
  @ApiProperty()
  timeEstimate: string;

  @Column()
  @ApiProperty({ enum: Object.keys(ActionStatus) })
  @IsNotEmpty()
  status: ActionStatus;

  @CreateDateColumn()
  @ApiProperty()
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty()
  updatedAt: Date;

  @OneToMany(() => UserAction, (userAction) => userAction.action)
  @JoinTable()
  userRelations: UserAction[];

  @OneToMany(() => ActionEvent, (actionEvent) => actionEvent.action, {
    cascade: true,
  })
  @ApiProperty({ type: () => [ActionEvent] })
  updates: ActionEvent[];

  @Expose()
  @ApiProperty()
  get usersJoined(): number {
    return (
      this.userRelations?.filter(
        (ur) =>
          ur.status === UserActionRelation.joined ||
          ur.status === UserActionRelation.completed,
      ).length || 0
    );
  }
}