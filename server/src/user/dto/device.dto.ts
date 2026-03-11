import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { UserDevice } from '../entities/user-device.entity';

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

export class UserDeviceDto extends PickType(UserDevice, ['id']) {}

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

export class RegisterLiveActivityPushToStartTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pushToStartToken: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  deviceId?: string;
}

export class RegisterLiveActivityUpdateTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  activityId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  updateToken: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  actionId: number;
}
