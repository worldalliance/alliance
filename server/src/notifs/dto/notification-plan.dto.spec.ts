import { ReminderGroup } from "src/actions/entities/reminder-group.entity";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import { User } from "src/user/entities/user.entity";
import { NotificationChannel } from "../notif-utils";
import { PreviewNotificationPlanDto } from "./notification-plan.dto";

function preview(overrides: Partial<User>): PreviewNotificationPlanDto {
  const user = Object.assign(new User(), {
    turnedOffAllNotifs: false,
    contractEvents: [
      Object.assign(new ContractEvent(), {
        type: ContractEventType.SIGNED,
        date: new Date(0),
      }),
    ],
    pushNotifsForActions: true,
    textNotifsForActions: true,
    emailNotifsForActions: true,
    phoneNumber: "+14155552671",
    phoneNumberUnsubscribed: false,
    ...overrides,
  });
  return new PreviewNotificationPlanDto({
    scheduledFor: new Date(0),
    user,
    group: new ReminderGroup(),
  });
}

describe("PreviewNotificationPlanDto", () => {
  it("lists every channel the user has enabled", () => {
    expect(preview({}).channels).toEqual([
      NotificationChannel.Push,
      NotificationChannel.Text,
      NotificationChannel.Email,
    ]);
  });

  it("omits channels the user has turned off", () => {
    expect(
      preview({ pushNotifsForActions: false, phoneNumber: null }).channels,
    ).toEqual([NotificationChannel.Email]);
  });

  it("lists no channels when the user turned off all notifications", () => {
    expect(preview({ turnedOffAllNotifs: true }).channels).toEqual([]);
  });
});
