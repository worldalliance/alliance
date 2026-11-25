import { ApiProperty } from "@nestjs/swagger";

export class WebHandoffDto {
  @ApiProperty({ description: "Single use, valid for 60 seconds" })
  code: string;

  constructor(input: { code: string }) {
    this.code = input.code;
  }
}
