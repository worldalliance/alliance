import { ApiProperty } from "@nestjs/swagger";
import { ReminderGroup } from "src/actions/entities/reminder-group.entity";
import { UserDto } from "src/user/dto/user.dto";
import { User } from "src/user/entities/user.entity";
import { NotificationChannel } from "../notif-utils";

export class NotificationPlan {
  @ApiProperty()
  scheduledFor: Date;
  @ApiProperty()
  user: User;
  group: ReminderGroup;
}

export type PreviewNotificationPlan = {
  plan: NotificationPlan;
  channels: NotificationChannel[];
  missNumber: number | null;
};

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

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      "The member's run of consecutive missed suites, once a missed-suite group's suite has closed",
  })
  missNumber: number | null;

  constructor(input: PreviewNotificationPlan) {
    const { plan } = input;
    this.scheduledFor = plan.scheduledFor;
    this.user = new UserDto(plan.user);
    this.channels = input.channels;
    this.missNumber = input.missNumber;
  }
}
