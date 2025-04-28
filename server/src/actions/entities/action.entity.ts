import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  JoinTable,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserAction } from './user-action.entity';

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

  @Column()
  description: string;

  @Column()
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => UserAction, (userAction) => userAction.action)
  @JoinTable()
  userRelations: UserAction[];
}
