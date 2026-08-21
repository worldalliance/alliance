import { Inject, Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PickType } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import { randomUUID } from "node:crypto";
import { UserDevice } from "src/user/entities/user-device.entity";
import {
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  Not,
  Or,
  QueryFailedError,
  type Repository,
} from "typeorm";
import { Push } from "./push.entity";

export const EXPO_CLIENT = Symbol("EXPO_CLIENT");

// Expo discards receipts ~24h after delivery, so a pending push older than
// this will never get a receipt and must stop being re-checked. 48h = 24h
// receipt TTL + generous slack for delivery lagging creation.
const RECEIPT_MAX_AGE_MS = 1000 * 60 * 60 * 48;

export class CreatePushMessage extends PickType(Push, [
  "expoPushToken",
  "body",
  "idempotencyKey",
  "notification",
  "unreadContent",
]) {
  userId: number;
  screen?: string;
}

@Injectable()
export class PushService {
  constructor(
    @Inject(EXPO_CLIENT)
    private readonly expo: Expo,
    @InjectRepository(Push)
    private readonly pushRepository: Repository<Push>,
    @InjectRepository(UserDevice)
    private readonly userDeviceRepository: Repository<UserDevice>,
  ) {}

  async sendPushNotification(
    userId: number,
    token: string,
    body: string,
  ): Promise<Push> {
    const message: CreatePushMessage = {
      userId,
      expoPushToken: token,
      body,
      idempotencyKey: randomUUID(),
    };
    return (await this.sendMessages([message]))[0];
  }

  async getPushForAllUserDevices(
    userId: number,
    message: Omit<CreatePushMessage, "expoPushToken">,
    notifCreatedAt?: Date,
  ): Promise<CreatePushMessage[]> {
    const devices = await this.userDeviceRepository.find({
      where: {
        user: { id: userId },
        createdAt: notifCreatedAt ? LessThanOrEqual(notifCreatedAt) : undefined,
      },
    });
    const messages = devices
      .filter((device) => !!device.expoPushToken)
      .map((device) => ({
        ...message,
        expoPushToken: device.expoPushToken!,
        idempotencyKey: `${message.idempotencyKey}-${device.id}`,
      }));
    return messages;
  }

  async sendMessages(messages: CreatePushMessage[]): Promise<Push[]> {
    const expoMessages: ExpoPushMessage[] = [];
    const pushEntities: Push[] = [];

    for (const message of messages) {
      if (!Expo.isExpoPushToken(message.expoPushToken)) {
        console.error(
          `Push token ${message.expoPushToken} is not a valid Expo push token`,
        );
        continue;
      }
      let pushEntity = this.pushRepository.create({
        ...message,
        user: { id: message.userId },
      });
      try {
        pushEntity = await this.pushRepository.save(pushEntity);
      } catch (error) {
        if (error instanceof QueryFailedError) {
          console.error(`skipping duplicate push: ${error.message}`);
        }
        continue;
      }

      // Construct a message (see https://docs.expo.io/push-notifications/sending-notifications/)
      expoMessages.push({
        to: message.expoPushToken,
        sound: "default",
        body: message.body,
        data: {
          cid: pushEntity.id,
          screen: message.screen,
          notificationId: message.notification?.id ?? message.unreadContent?.id,
          notificationSourceType: message.notification
            ? "notification"
            : message.unreadContent
              ? "unread_content"
              : undefined,
        },
      });

      pushEntities.push(pushEntity);
    }

    // The Expo push notification service accepts batches of notifications so
    // that you don't need to send 1000 requests to send 1000 notifications. We
    // recommend you batch your notifications to reduce the number of requests
    // and to compress them (notifications with similar content will get
    // compressed).
    const chunks = this.expo.chunkPushNotifications(expoMessages);

    const tickets: ExpoPushTicket[] = [];
    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        console.log(ticketChunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error(error);
      }
    }

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      pushEntities[i].ticketStatus = ticket.status;

      if (ticket.status === "ok") {
        pushEntities[i].receiptId = ticket.id;
        pushEntities[i].receiptStatus = "pending";
      } else {
        // https://docs.expo.io/push-notifications/sending-notifications/#individual-errors
        pushEntities[i].errorCode = ticket.details?.error ?? null;
        pushEntities[i].errorMessage = ticket.message;
        console.error(`expo push error: ${ticket.details?.error}`);
        console.error(`expo push error: ${ticket.message}`);
        if (ticket.details?.error === "DeviceNotRegistered") {
          const userDevice = await this.userDeviceRepository.findOne({
            where: { expoPushToken: pushEntities[i].expoPushToken },
          });
          if (userDevice) {
            await this.userDeviceRepository.remove(userDevice); // todo: worth keeping+invalidating somehow or no?
          }
        }
      }
    }

    return await this.pushRepository.save(pushEntities);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async queryExpoStatuses() {
    const pendingPushes = await this.pushRepository.find({
      where: {
        receiptStatus: "pending",
        lastCheckedStatusAt: Or(
          IsNull(),
          LessThan(
            new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
          ),
        ),
        receiptId: Not(IsNull()),
      },
    });
    const idToPushIdx = new Map<string, number>();
    for (let i = 0; i < pendingPushes.length; i++) {
      idToPushIdx.set(pendingPushes[i].receiptId!, i);
    }

    const receiptIds = pendingPushes.map((push) => push.receiptId!);
    const receiptIdChunks =
      this.expo.chunkPushNotificationReceiptIds(receiptIds);

    const resolvedPushes = new Set<Push>();

    for (const chunk of receiptIdChunks) {
      try {
        const receipts =
          await this.expo.getPushNotificationReceiptsAsync(chunk);

        for (const receiptId in receipts) {
          const receipt = receipts[receiptId];
          const push = pendingPushes[idToPushIdx.get(receiptId)!];
          console.log("updating push status", receipt.status);
          push.receiptStatus = receipt.status;
          resolvedPushes.add(push);
          if (receipt.status === "ok") {
            continue;
          } else if (receipt.status === "error") {
            console.error(
              `There was an error sending a notification: ${receipt.message}`,
            );
            push.errorCode = receipt.details?.error ?? null;
            push.errorMessage = receipt.message;

            if (receipt.details && receipt.details.error) {
              // https://docs.expo.io/push-notifications/sending-notifications/#individual-errors
              console.error(`expo push error: ${receipt.details.error}`);
            }
          }
        }
      } catch (error) {
        console.error(error);
      }
    }

    const now = new Date();
    for (const push of resolvedPushes) {
      push.lastCheckedStatusAt = now;
    }
    const saved = await this.pushRepository.save([...resolvedPushes]);

    // Pushes with no receipt yet only need their recheck timestamp bumped;
    // one batched UPDATE instead of a row-at-a-time save().
    const unresolvedIds = pendingPushes
      .filter((push) => !resolvedPushes.has(push))
      .map((push) => push.id);
    if (unresolvedIds.length > 0) {
      await this.pushRepository.update(
        { id: In(unresolvedIds) },
        { lastCheckedStatusAt: now },
      );
    }

    await this.pushRepository.update(
      {
        receiptStatus: "pending",
        receiptId: Not(IsNull()),
        createdAt: LessThan(new Date(Date.now() - RECEIPT_MAX_AGE_MS)),
      },
      { receiptStatus: "expired" },
    );

    return saved;
  }
}
