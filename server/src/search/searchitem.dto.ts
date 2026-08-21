import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsOptional, IsString } from "class-validator";

export enum SearchItemType {
  User = "user",
  Action = "action",
  Post = "post",
  Recent = "recent",
  Page = "page",
  Other = "other",
}

export type SearchItem = {
  id: string;
  name: string;
  date?: Date;
  image?: string;
  webAppLocation: string;
  secondaryData?: string[];
  type: SearchItemType;
};

export class SearchItemDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  date?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  image?: string;

  @ApiProperty()
  @IsString()
  webAppLocation: string;

  @ApiPropertyOptional({ type: [String], isArray: true })
  @IsOptional()
  secondaryData?: string[];

  @ApiProperty({
    enum: SearchItemType,
    enumName: "SearchItemType",
  })
  @IsEnum(SearchItemType)
  type: SearchItemType;

  constructor(input: SearchItem) {
    this.id = input.id;
    this.name = input.name;
    this.date = input.date;
    this.image = input.image;
    this.webAppLocation = input.webAppLocation;
    this.secondaryData = input.secondaryData;
    this.type = input.type;
  }
}

export class SaveSearchSelectionDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty({
    enum: SearchItemType,
    enumName: "SearchItemType",
  })
  @IsEnum(SearchItemType)
  type: SearchItemType;
}
