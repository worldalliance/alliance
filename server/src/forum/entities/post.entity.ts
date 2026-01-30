import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsNotEmpty, IsOptional } from 'class-validator';
import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { Action } from '../../actions/entities/action.entity';
import { User } from '../../user/entities/user.entity';
import { EditableContent } from './editablecontent.entity';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';

@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @IsNotEmpty()
  title: string;

  @OneToOne(() => EditableContent, {
    cascade: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  @ApiProperty({ type: () => EditableContent })
  @Allow()
  @Type(() => EditableContent)
  editableContent: EditableContent;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  @ApiProperty()
  @Allow()
  @Type(() => User)
  author: User;

  @Column()
  @ApiProperty()
  @Allow()
  authorId: number;

  @ManyToOne(() => Action, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  @ApiProperty({ required: false, type: () => Action })
  @Allow()
  @Type(() => Action)
  action: Action;

  @Column({ nullable: true })
  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @Allow()
  actionId?: number;

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  pinned: boolean;

  @UpdateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @Allow()
  visibleAt?: Date;

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  deleted: boolean;

  @ManyToMany(() => User, { onDelete: 'CASCADE', eager: true })
  @ApiProperty({ type: () => User, isArray: true })
  @JoinTable()
  @Allow()
  @Type(() => User)
  likes: User[];

  @RelationId((post: Post) => post.likes)
  @ApiProperty({ type: () => Number, isArray: true })
  @Allow()
  likesIds: number[];

  @Column({ default: false })
  @ApiProperty()
  @Allow()
  qaMode: boolean;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  expertLabel?: string;

  @ManyToMany(() => User, { onDelete: 'CASCADE', eager: true })
  @ApiProperty({ type: () => User, isArray: true })
  @JoinTable()
  @Allow()
  @Type(() => User)
  experts: User[];

  @RelationId((post: Post) => post.experts)
  @ApiProperty({ type: () => Number, isArray: true })
  @Allow()
  expertIds: number[];

  @ManyToMany(() => User, { onDelete: 'CASCADE', eager: true })
  @ApiProperty({ type: () => User, isArray: true })
  @JoinTable()
  @Allow()
  @Type(() => User)
  authors: User[];

  @RelationId((post: Post) => post.authors)
  @ApiProperty({ type: () => Number, isArray: true })
  @Allow()
  authorIds: number[];
}
