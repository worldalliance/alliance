import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsOptional } from 'class-validator';
import { CreateDateColumnTz } from 'src/datasources/basecolumns';
import type { Relation } from 'src/utils/Repository';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AmbassadorProgramMember } from './ambassador-program-member.entity';
import { User } from './user.entity';

@Entity()
@Index(['programMember', 'interactionDate'])
export class AmbassadorProgramInteraction {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column({ type: 'text' })
  @ApiProperty()
  @Allow()
  text: string;

  @Column({ type: 'date' })
  @ApiProperty({ type: String, format: 'date' })
  @Allow()
  interactionDate: string;

  @CreateDateColumnTz()
  @ApiProperty({ type: Date })
  @Type(() => Date)
  @Allow()
  createdAt: Date;

  @ManyToOne(() => AmbassadorProgramMember, (member) => member.interactions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'programMemberId' })
  @ApiProperty({ type: () => AmbassadorProgramMember })
  @Type(() => AmbassadorProgramMember)
  @Allow()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  programMember: Relation<AmbassadorProgramMember>;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  @ApiPropertyOptional({ type: () => User, nullable: true })
  @Type(() => User)
  @IsOptional()
  createdBy?: Relation<User> | null;
}
