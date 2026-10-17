import type { UpdateProfileDto } from "@alliance/shared/client";
import { toTimeInputValue, toWireTime } from "@alliance/shared/forms/timeUtils";
import { CardStyle } from "@alliance/shared/styles/card";
import TimeZoneSelect from "@alliance/sharedweb/forms/TimeZoneSelect";
import Card from "@alliance/sharedweb/ui/Card";
import DeviceTimeZoneOffer from "./DeviceTimeZoneOffer";

type Props = {
  editableUser: UpdateProfileDto;
  updateEditableUser: (updates: Partial<UpdateProfileDto>) => void;
  impersonating: boolean;
};

export default function NotificationSettings({
  editableUser,
  updateEditableUser,
  impersonating,
}: Props) {
  return (
    <Card
      id="notifications"
      style={CardStyle.White}
      className="p-6 scroll-mt-[calc(var(--navbar-top-bar-height)+1rem)]"
    >
      <h2 className="!font-semibold !text-2xl mb-4">Notifications</h2>

      <div className="flex flex-col md:flex-row gap-y-2 gap-x-12 font-medium">
        <div>
          <p className=" mb-1">Preferred reminder time:</p>
          <input
            type="time"
            className="border border-zinc-300 rounded px-3 py-3 self-start min-w-[200px]"
            value={toTimeInputValue(editableUser.preferredReminderTime)}
            onChange={(event) =>
              updateEditableUser({
                preferredReminderTime: toWireTime(event.target.value),
              })
            }
          />
        </div>
        <div className="flex-1">
          <p className="mb-1">Your time zone for reminders:</p>
          <TimeZoneSelect
            value={editableUser.timeZone ?? undefined}
            onChange={(tz) => updateEditableUser({ timeZone: tz })}
          />
          {!impersonating && (
            <DeviceTimeZoneOffer
              saved={editableUser.timeZone ?? undefined}
              onUse={(tz) => updateEditableUser({ timeZone: tz })}
            />
          )}
        </div>
      </div>
    </Card>
  );
}
