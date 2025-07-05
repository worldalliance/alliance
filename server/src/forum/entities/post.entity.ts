import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../user/user.entity';
import { Action } from '../../actions/entities/action.entity';
import { Reply } from './reply.entity';
import { IsNotEmpty } from 'class-validator';
@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column()
  @ApiProperty()
  @IsNotEmpty()
  title: string;

  @Column('text')
  @ApiProperty()
  @IsNotEmpty()
  content: string;

  @ManyToOne(() => User)
  @JoinColumn()
  @ApiProperty()
  author: User;

  @Column()
  @ApiProperty()
  authorId: number;

  @ManyToOne(() => Action, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  @ApiProperty({ required: false, type: () => Action })
  action: Action;

  @Column({ nullable: true })
  @ApiProperty({ required: false })
  actionId: number;

  @OneToMany(() => Reply, (reply) => reply.post)
  @ApiProperty({ type: [Reply] })
  replies: Reply[];

  @CreateDateColumn()
  @ApiProperty()
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty()
  updatedAt: Date;
}
