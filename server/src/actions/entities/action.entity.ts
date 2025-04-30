import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  JoinTable,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserAction } from './user-action.entity';

export enum ActionStatus {
  Active = 'active',
  Upcoming = 'upcoming',
  Past = 'past',
  Draft = 'draft',
}

@Entity()
export class Action {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  category: string;

  @Column()
  whyJoin: string;

  @Column({ nullable: true })
  image: string;

  @Column()
  description: string;

  @Column()
  status: ActionStatus;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => UserAction, (userAction) => userAction.action)
  @JoinTable()
  userRelations: UserAction[];
}
