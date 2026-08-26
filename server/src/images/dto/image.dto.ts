import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class UploadImageDto {
  @ApiProperty()
  @IsNotEmpty()
  file: string;
}

export type UploadImageResponse = {
  url: string;
  key: string;
};

export class UploadImageResponseDto {
  @ApiProperty()
  url: string;

  @ApiProperty()
  key: string;

  constructor(input: UploadImageResponse) {
    this.url = input.url;
    this.key = input.key;
  }
}
