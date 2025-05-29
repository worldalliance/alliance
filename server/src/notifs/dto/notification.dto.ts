import { Notification } from '../entities/notification.entity';
import { ApiProperty } from '@nestjs/swagger';
import { PickType } from '@nestjs/swagger';

export class NotificationDto extends PickType(Notification, [
  'id',
  'message',
  'category',
  'appLocation',
  'read',
  'createdAt',
  'updatedAt',
]) {}
