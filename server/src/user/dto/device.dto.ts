import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import { UserDevice } from "../entities/user-device.entity";

export class RegisterDeviceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  deviceType: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  expoPushToken: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  deviceId?: string;
}

export class UserDeviceDto extends PickType(UserDevice, ["id"]) {
  constructor(id: string) {
    super();
    this.id = id;
  }
}

export class TestPushNotificationDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  userId: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;
}
