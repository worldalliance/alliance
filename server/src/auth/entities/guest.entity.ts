import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { Type } from 'class-transformer';
import { Entity, PrimaryGeneratedColumn } from 'typeorm';
import { CreateDateColumnTz } from 'src/datasources/basecolumns';

@Entity()
export class Guest {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  @Allow()
  id: string;

  @CreateDateColumnTz()
  @ApiProperty()
  @Allow()
  @Type(() => Date)
  createdAt: Date;
}
