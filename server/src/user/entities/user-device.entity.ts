import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import type { Relation } from 'src/utils/Repository';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
@Unique(['expoPushToken'])
export class UserDevice {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  id: string;

  @ManyToOne(() => User, (user) => user.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Column({ type: 'varchar', nullable: true })
  deviceType: string | null;

  @Column({ type: 'varchar', nullable: true })
  expoPushToken: string | null;

  @Column({ type: 'varchar', nullable: true })
  liveActivityPushToStartToken: string | null;

  @UpdateDateColumnTz()
  updatedAt: Date;

  @CreateDateColumnTz()
  createdAt: Date;
}
