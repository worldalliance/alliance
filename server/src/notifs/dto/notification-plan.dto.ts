import { ApiProperty } from "@nestjs/swagger";
import { ReminderGroup } from "src/actions/entities/reminder-group.entity";
import { UserDto } from "src/user/dto/user.dto";
import { User } from "src/user/entities/user.entity";
import {
  userActionNotifsEnabled_email,
  userActionNotifsEnabled_push,
  userActionNotifsEnabled_text,
} from "src/user/user.utils";
import { NotificationChannel } from "../notif-utils";

export class NotificationPlan {
  @ApiProperty()
  scheduledFor: Date;
  @ApiProperty()
  user: User;
  group: ReminderGroup;
}

export class PreviewNotificationPlanDto {
  @ApiProperty()
  scheduledFor: Date;

  @ApiProperty({ type: () => UserDto })
  user: UserDto;

  @ApiProperty({
    enum: NotificationChannel,
    enumName: "NotificationChannel",
    isArray: true,
  })
  channels: NotificationChannel[];

  constructor(plan: NotificationPlan) {
    this.scheduledFor = plan.scheduledFor;
    this.user = new UserDto(plan.user);
    this.channels = [];
    if (userActionNotifsEnabled_push(plan.user))
      this.channels.push(NotificationChannel.Push);
    if (userActionNotifsEnabled_text(plan.user))
      this.channels.push(NotificationChannel.Text);
    if (userActionNotifsEnabled_email(plan.user))
      this.channels.push(NotificationChannel.Email);
  }
}
