import { ApiProperty } from '@nestjs/swagger';

import {
  Column,
  CreateDateColumn,
  Entity,
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
  dateCreated: Date;

  @UpdateDateColumn()
  dateUpdated: Date;
}
