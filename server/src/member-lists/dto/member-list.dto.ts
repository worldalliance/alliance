import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { trim } from "src/utils/transforms";

/** A list with its current membership. */
export type MemberListDtoArgs = {
  id: string;
  name: string;
  versionId: number;
  userIds: number[];
};

export class MemberListDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ description: "The current membership version's id." })
  versionId: number;
  @ApiProperty({ type: Number, isArray: true }) userIds: number[];

  constructor(input: MemberListDtoArgs) {
    this.id = input.id;
    this.name = input.name;
    this.versionId = input.versionId;
    this.userIds = input.userIds;
  }
}

export class SaveMemberListDto {
  @ApiProperty({ description: "What formulas call it, in quotes." })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: "Enter a name." })
  @MaxLength(100)
  @Matches(/^[^\0]*$/, {
    message: "The name has a character that can't be stored.",
  })
  name: string;

  @ApiProperty({ type: Number, isArray: true })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10000)
  @IsInt({ each: true })
  userIds: number[];
}

export class UpdateMemberListDto extends SaveMemberListDto {
  @ApiProperty({ description: "The membership version the admin edited." })
  @IsInt()
  baseVersionId: number;

  @ApiProperty({ description: "The name the admin saw before editing." })
  @IsString()
  baseName: string;
}
