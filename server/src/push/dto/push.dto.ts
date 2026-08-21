import { PickType } from "@nestjs/swagger";
import { Push } from "../push.entity";

export class PushDto extends PickType(Push, [
  "id",
  "user",
  "expoPushToken",
  "createdAt",
  "body",
  "screen",
  "updatedAt",
  "receiptId",
  "ticketStatus",
  "receiptStatus",
  "errorCode",
  "errorMessage",
  "lastCheckedStatusAt",
  "idempotencyKey",
  "notification",
  "unreadContent",
  "actionEventNotif",
  "openedAt",
]) {
  constructor(push: Push) {
    super();
    this.id = push.id;
    this.user = push.user;
    this.expoPushToken = push.expoPushToken;
    this.createdAt = push.createdAt;
    this.body = push.body;
    this.screen = push.screen;
    this.updatedAt = push.updatedAt;
    this.receiptId = push.receiptId;
    this.ticketStatus = push.ticketStatus;
    this.receiptStatus = push.receiptStatus;
    this.errorCode = push.errorCode;
    this.errorMessage = push.errorMessage;
    this.lastCheckedStatusAt = push.lastCheckedStatusAt;
    this.idempotencyKey = push.idempotencyKey;
    this.notification = push.notification;
    this.unreadContent = push.unreadContent;
    this.actionEventNotif = push.actionEventNotif;
    this.openedAt = push.openedAt;
  }
}
