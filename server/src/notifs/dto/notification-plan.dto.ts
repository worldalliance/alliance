import { ApiProperty } from "@nestjs/swagger";
import { ReminderGroup } from "src/actions/entities/reminder-group.entity";
import { User } from "src/user/entities/user.entity";
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

  @ApiProperty()
  user: User;

  @ApiProperty({
    enum: NotificationChannel,
    enumName: "NotificationChannel",
    isArray: true,
  })
  channels: NotificationChannel[];

  constructor(plan: NotificationPlan, channels: NotificationChannel[]) {
    this.scheduledFor = plan.scheduledFor;
    this.user = plan.user;
    this.channels = channels;
  }
}
