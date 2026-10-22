import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import {
  IsBoolean,
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

  @ApiPropertyOptional({
    description: "The build handles badge-only pushes quietly",
  })
  @IsBoolean()
  @IsOptional()
  taskBadgePushes?: boolean;
}

export class UnregisterDeviceDto {
  @ApiProperty()
  @IsUUID()
  deviceId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  expoPushToken: string;
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
