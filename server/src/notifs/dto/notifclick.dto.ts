import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class NotifClickDto {
  @IsNotEmpty()
  cid: string;
}

export class NotifClickResponseDto {
  @ApiProperty()
  mms: boolean;

  constructor(mms: boolean) {
    this.mms = mms;
  }
}
