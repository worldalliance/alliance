import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { Repository } from 'typeorm';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

@Injectable()
export class NotifsService implements OnModuleInit {
  private readonly expo: Expo;

  constructor(
    @InjectRepository(Notification)
    private readonly notifsRepository: Repository<Notification>,
  ) {
    this.expo = new Expo();
  }

  async onModuleInit() {
    await this.processUnsentNotifications();
  }

  async findAll(userId: number) {
    const notifs = await this.notifsRepository.find({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    return notifs;
  }

  findOne(id: number) {
    return this.notifsRepository.findOne({
      where: { id },
    });
  }

  async setRead(id: number, userId: number) {
    const notif = await this.notifsRepository.findOne({
      where: { id, user: { id: userId } },
      relations: ['user'],
    });
    if (!notif) {
      throw new NotFoundException('Notification not found');
    }
    if (notif.user.id !== userId) {
      throw new UnauthorizedException();
    }
    return this.notifsRepository.update(id, { read: true });
  }

  async sendPushNotification(notification: Notification) {
    const user = notification.user;

    if (!user || !user.pushTokens || user.pushTokens.length === 0) {
      console.warn('User or push tokens not found');
      return;
    }

    const messages: ExpoPushMessage[] = [];

    for (const token of user.pushTokens) {
      if (!Expo.isExpoPushToken(token)) {
        console.warn(`Invalid Expo push token: ${token}`);
        continue;
      }

      messages.push({
        to: token,
        sound: 'default',
        title: notification.category ?? 'Notification',
        body: notification.message ?? '',
        data: {
          notifId: notification.id,
          mobileAppLocation: notification.mobileAppLocation,
        },
      });
    }

    if (messages.length === 0) {
      console.warn('No valid push tokens to send to');
      return;
    }

    const receipts: ExpoPushTicket[] = [];

    try {
      const chunks = this.expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        receipts.push(...ticketChunk);
      }
    } catch (err) {
      console.error('Expo push error:', err);
      throw err;
    }

    return receipts;
  }

  async processUnsentNotifications() {
    const unsent = await this.notifsRepository.find({
      where: { sent: false },
      relations: ['user'],
    });

    for (const notification of unsent) {
      try {
        await this.sendPushNotification(notification);
        await this.notifsRepository.update(notification.id, { sent: true });
      } catch (err) {
        console.error(`Failed to send notification ${notification.id}`, err);
      }
    }

    console.log(`Processed ${unsent.length} unsent notifications.`);
  }
}
