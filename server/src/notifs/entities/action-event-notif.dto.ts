import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { ProfileDto } from "src/user/dto/user.dto";
import type { WithRelations } from "src/utils/Repository";
import { ActionEventNotif } from "./action-event-notif.entity";

export class ActionEventNotifDto extends PickType(ActionEventNotif, [
  "id",
  "type",
  "mail",
  "mms",
  "pushes",
  "notificationId",
  "reminderGroup",
  "sent",
  "idempotency_key",
  "createdAt",
]) {
  @ApiProperty({ type: ProfileDto })
  user: ProfileDto;

  /** When the email's link was first opened; null when unknown or never. */
  @ApiPropertyOptional({ type: Date, nullable: true })
  mailClickedAt?: Date | null;

  /** When the text's link was first opened; null when unknown or never. */
  @ApiPropertyOptional({ type: Date, nullable: true })
  mmsClickedAt?: Date | null;

  constructor(
    actionEventNotif: WithRelations<ActionEventNotif, { user: true }>,
    firstOpenedAt?: ReadonlyMap<string, Date>,
  ) {
    super();
    this.id = actionEventNotif.id;
    this.type = actionEventNotif.type;
    this.mail = actionEventNotif.mail;
    this.mms = actionEventNotif.mms;
    this.pushes = actionEventNotif.pushes;
    this.notificationId = actionEventNotif.notificationId;
    this.reminderGroup = actionEventNotif.reminderGroup;
    this.sent = actionEventNotif.sent;
    this.idempotency_key = actionEventNotif.idempotency_key;
    this.createdAt = actionEventNotif.createdAt;
    this.user = new ProfileDto(actionEventNotif.user);
    if (firstOpenedAt) {
      const openedAt = (cid: string | null | undefined) =>
        (cid && firstOpenedAt.get(cid)) || null;
      this.mailClickedAt = openedAt(actionEventNotif.mail?.cid);
      this.mmsClickedAt = openedAt(actionEventNotif.mms?.cid);
    }
  }
}
