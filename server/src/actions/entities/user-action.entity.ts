import { CreateDateColumn, Entity, Unique, UpdateDateColumn } from 'typeorm';

import { User } from '../../user/user.entity';
import { Column, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Action } from './action.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum UserActionRelation {
  COMPLETED = 'completed',
  JOINED = 'joined',
  SEEN = 'seen',
  DECLINED = 'declined',
  NONE = 'none',
}

@Entity()
@Unique(['user', 'action'])
export class UserAction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.actionRelations)
  user: User;

  @ManyToOne(() => Action, (action) => action.userRelations)
  action: Action;

  @Column({
    type: 'varchar', // should be an enum but sqlite doesn't support it (which we use for e2e tests only)
    default: UserActionRelation.NONE,
  })
  @ApiProperty({ enum: Object.keys(UserActionRelation) })
  status: UserActionRelation;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
