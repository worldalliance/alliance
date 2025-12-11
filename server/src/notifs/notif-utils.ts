import { randomBytes } from 'crypto';

export function generateCIDForNotif() {
  return randomBytes(5).toString('hex');
}

export function generateCIDForShareUrl() {
  return 'share-' + randomBytes(5).toString('hex');
}

export enum NotificationChannel {
  Text = 'text',
  Email = 'email',
  Push = 'push',
}
