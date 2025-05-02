import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../user/user.entity';

import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Communique {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column()
  @ApiProperty()
  title: string;

  @Column('text')
  @ApiProperty()
  bodyText: string;

  @Column({ nullable: true })
  @ApiProperty({ nullable: true })
  headerImage: string;

  @CreateDateColumn()
  @ApiProperty()
  dateCreated: Date;

  @UpdateDateColumn()
  dateUpdated: Date;

  @ManyToMany(() => User, (user) => user.communiquesRead)
  @JoinTable({ name: 'communique_users_read' })
  usersRead: User[];
}
