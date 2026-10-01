import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { trim } from "src/utils/transforms";
import type { WaitlistTag } from "../entities/waitlist-tag.entity";

export class WaitlistTagDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  constructor(input: WaitlistTag) {
    this.id = input.id;
    this.name = input.name;
  }
}

export type AdminWaitlistTag = { tag: WaitlistTag; entryCount: number };

export class AdminWaitlistTagDto extends WaitlistTagDto {
  @ApiProperty()
  entryCount: number;

  constructor(input: AdminWaitlistTag) {
    super(input.tag);
    this.entryCount = input.entryCount;
  }
}

export class SaveWaitlistTagDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
