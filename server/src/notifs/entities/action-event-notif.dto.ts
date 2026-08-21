import { ApiProperty, PickType } from "@nestjs/swagger";
import { ProfileDto } from "src/user/dto/user.dto";
import { ActionEventNotif } from "./action-event-notif.entity";

export class ActionEventNotifDto extends PickType(ActionEventNotif, [
  "id",
  "type",
  "mail",
  "mms",
  "pushes",
  "reminderGroup",
  "sent",
  "idempotency_key",
  "createdAt",
]) {
  @ApiProperty({ type: ProfileDto })
  user: ProfileDto;

  constructor(actionEventNotif: ActionEventNotif) {
    super();
    this.id = actionEventNotif.id;
    this.type = actionEventNotif.type;
    this.mail = actionEventNotif.mail;
    this.mms = actionEventNotif.mms;
    this.pushes = actionEventNotif.pushes;
    this.reminderGroup = actionEventNotif.reminderGroup;
    this.sent = actionEventNotif.sent;
    this.idempotency_key = actionEventNotif.idempotency_key;
    this.createdAt = actionEventNotif.createdAt;
    this.user = new ProfileDto(actionEventNotif.user);
  }
}
