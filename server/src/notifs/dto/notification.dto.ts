import { Notification } from '../entities/notification.entity';
import { PickType } from '@nestjs/swagger';

export class NotificationDto extends PickType(Notification, [
  'id',
  'message',
  'category',
  'webAppLocation',
  'mobileAppLocation',
  'read',
  'createdAt',
  'updatedAt',
]) {}
