import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { PostTag } from "../entities/post-tag.entity";

export class PostTagDto extends PickType(PostTag, ["id", "name", "sortOrder"]) {
  constructor(input: PostTag) {
    super();
    this.id = input.id;
    this.name = input.name;
    this.sortOrder = input.sortOrder;
  }
}

export class PostTagInputDto {
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  id?: number;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name: string;
}

export class UpdatePostTagsDto {
  @ApiProperty({ type: () => PostTagInputDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostTagInputDto)
  tags: PostTagInputDto[];

  @ApiProperty({ type: Number, isArray: true })
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  knownTagIds: number[];
}
