import { CreateDateColumn, Entity, Unique, UpdateDateColumn } from 'typeorm';

import { User } from '../../user/user.entity';
import { Column, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Action } from './action.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum UserActionRelation {
  completed = 'completed',
  joined = 'joined',
  seen = 'seen',
  declined = 'declined',
  none = 'none',
}

@Entity()
@Unique(['user', 'action'])
export class UserAction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.actionRelations, {
    onDelete: 'CASCADE',
  })
  user: User;

  @ManyToOne(() => Action, (action) => action.userRelations, {
    onDelete: 'CASCADE',
  })
  action: Action;

  @Column({
    type: 'varchar', // should be an enum but sqlite doesn't support it (which we use for e2e tests only)
    default: UserActionRelation.none,
  })
  @ApiProperty({ enum: Object.keys(UserActionRelation) })
  status: UserActionRelation;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ApiProperty()
  @Column({ nullable: true })
  dateCommitted: Date;

  @ApiProperty()
  @Column({ nullable: true })
  dateCompleted: Date;

  @ApiProperty()
  @Column({ nullable: true })
  deadline: Date;
}
