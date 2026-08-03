import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { trim, trimStringArray } from 'src/utils/transforms';
import { ActionPartnershipNote } from './action-partnership-note.entity';
import type { Relation } from 'src/utils/Repository';

@Entity()
export class ActionPartnershipResponse {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  organizationName: string;

  @Column({ default: '' })
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: false })
  @MaxLength(500)
  organizationWebsite: string;

  @Column()
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  personName: string;

  @Column()
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  contact: string;

  @Column({ type: 'jsonb' })
  @ApiProperty({ isArray: true, type: String })
  @Transform(trimStringArray)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  outreachChannels: string[];

  @Column({ type: 'text', default: '' })
  @ApiProperty()
  @Transform(trim)
  @ValidateIf((response: ActionPartnershipResponse) =>
    response.outreachChannels?.includes('Other'),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  outreachOtherDetails: string;

  @Column()
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  audienceSize: string;

  @Column({ type: 'text' })
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  desiredCollaboration: string;

  @Column({ type: 'text', default: '' })
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  notes: string;

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;

  @UpdateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  updatedAt: Date;

  @OneToMany(() => ActionPartnershipNote, (note) => note.response)
  @IsOptional()
  @Type(() => ActionPartnershipNote)
  notesHistory?: Relation<ActionPartnershipNote>[];
}
