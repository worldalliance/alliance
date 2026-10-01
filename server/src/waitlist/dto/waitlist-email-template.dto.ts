import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { trim } from "src/utils/transforms";
import type { WaitlistEmailTemplate } from "../entities/waitlist-email-template.entity";
import { WaitlistEmailContentDto } from "./waitlist-email-content.dto";

export class SaveWaitlistEmailTemplateDto extends WaitlistEmailContentDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}

export class WaitlistEmailTemplateDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  subject: string;

  @ApiProperty()
  body: string;

  @ApiProperty({ type: Date })
  updatedAt: Date;

  constructor(input: WaitlistEmailTemplate) {
    this.id = input.id;
    this.name = input.name;
    this.subject = input.subject;
    this.body = input.body;
    this.updatedAt = input.updatedAt;
  }
}
