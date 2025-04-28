import { CreateDateColumn, Entity, Unique, UpdateDateColumn } from 'typeorm';

import { User } from '../../user/user.entity';
import { Column, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Action } from './action.entity';

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
    type: 'enum',
    enum: Object.values(UserActionRelation),
    default: UserActionRelation.NONE,
  })
  status: UserActionRelation;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
