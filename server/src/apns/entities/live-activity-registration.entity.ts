import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { Action } from 'src/actions/entities/action.entity';
import type { Relation } from 'src/utils/Repository';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
@Index(['userId', 'actionId'], { unique: true })
export class LiveActivityRegistration {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Column()
  actionId: number;

  @ManyToOne(() => Action, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actionId' })
  action: Relation<Action>;

  @Column({ type: 'varchar', nullable: true })
  @ApiProperty({ nullable: true })
  updateToken: string | null;

  @Column({ type: 'varchar', nullable: true })
  @ApiProperty({ nullable: true })
  activityId: string | null;

  @Column({ default: false })
  @ApiProperty()
  pushToStartSent: boolean;

  @Column({ default: false })
  @ApiProperty()
  ended: boolean;

  @Column({ type: 'int', nullable: true })
  @ApiProperty({ nullable: true })
  lastCompletedCountSent: number | null;

  @CreateDateColumnTz()
  createdAt: Date;

  @UpdateDateColumnTz()
  updatedAt: Date;
}
