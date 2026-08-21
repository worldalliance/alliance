import { HTTP_URL_VALIDATOR_OPTIONS } from "@alliance/common/url";
import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { Allow, IsNotEmpty, IsString, IsUrl } from "class-validator";
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from "src/datasources/basecolumns";
import { trim } from "src/utils/transforms";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class ExternalShareTarget {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  name: string;

  @Column()
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @IsUrl(HTTP_URL_VALIDATOR_OPTIONS)
  url: string;

  @Column()
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  paramName: string;

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
}
