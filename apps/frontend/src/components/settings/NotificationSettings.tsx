import type { UpdateProfileDto } from "@alliance/shared/client";
import { toTimeInputValue, toWireTime } from "@alliance/shared/forms/timeUtils";
import { CardStyle } from "@alliance/shared/styles/card";
import TimeZoneSelect from "@alliance/sharedweb/forms/TimeZoneSelect";
import { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import InfoTooltip from "@alliance/sharedweb/ui/InfoTooltip";
import YesNoToggle from "@alliance/sharedweb/ui/YesNoToggle";
import DeviceTimeZoneOffer from "./DeviceTimeZoneOffer";

type Props = {
  editableUser: UpdateProfileDto;
  updateEditableUser: (updates: Partial<UpdateProfileDto>) => void;
  isLeader: boolean;
  impersonating: boolean;
};

export default function NotificationSettings({
  editableUser,
  updateEditableUser,
  isLeader,
  impersonating,
}: Props) {
  return (
    <Card
      id="notifications"
      style={CardStyle.White}
      className="p-6 scroll-mt-[calc(var(--navbar-top-bar-height)+1rem)]"
    >
      <div>
        <h2 className="!font-semibold !text-2xl mb-4">Notifications</h2>
        <p className="!font-medium mb-0">
          Receive action announcements / reminders via:
        </p>
        <div>
          {!(
            editableUser.emailNotifsForActions ||
            editableUser.pushNotifsForActions ||
            editableUser.textNotifsForActions
          ) && (
            <p className="text-sm text-zinc-500">
              You will not receive any notifications. Please keep a notification
              channel enabled if you need reminders to complete actions on time.
            </p>
          )}
        </div>
        <div className="flex flex-col divide-y divide-zinc-200 mt-2 border-t border-zinc-200">
          <div className="flex flex-row items-center justify-between gap-x-4 py-3">
            <span className="font-medium">Email</span>
            <YesNoToggle
              value={!!editableUser.emailNotifsForActions}
              onChange={(next) =>
                updateEditableUser({ emailNotifsForActions: next })
              }
              ariaLabel="Email notifications"
              yesLabel="On"
              noLabel="Off"
              yesColor={ButtonColor.Green}
            />
          </div>
          <div className="flex flex-row items-center justify-between gap-x-4 py-3">
            <span className="font-medium">Text/SMS</span>
            <YesNoToggle
              value={!!editableUser.textNotifsForActions}
              onChange={(next) =>
                updateEditableUser({ textNotifsForActions: next })
              }
              ariaLabel="Text/SMS notifications"
              yesLabel="On"
              noLabel="Off"
              yesColor={ButtonColor.Green}
            />
          </div>
          <div className="flex flex-row items-center justify-between gap-x-4 py-3">
            <span className="font-medium">Push</span>
            <YesNoToggle
              value={!!editableUser.pushNotifsForActions}
              onChange={(next) =>
                updateEditableUser({ pushNotifsForActions: next })
              }
              ariaLabel="Push notifications"
              yesLabel="On"
              noLabel="Off"
              yesColor={ButtonColor.Green}
            />
          </div>
        </div>
        <div className="flex flex-col divide-y divide-zinc-200 mt-12 ">
          {isLeader ? (
            <div className="flex flex-row items-center justify-between gap-x-4 py-3">
              <p className="!font-medium mb-0">
                Receive reminders for group members with uncompleted tasks?
              </p>
              <YesNoToggle
                value={!!editableUser.remindAboutUncompletedGroupMembers}
                onChange={(next) =>
                  updateEditableUser({
                    remindAboutUncompletedGroupMembers: next,
                  })
                }
                ariaLabel="Receive reminders for group members with uncompleted tasks"
                yesLabel="On"
                noLabel="Off"
                yesColor={ButtonColor.Green}
              />
            </div>
          ) : null}
          <div className="flex flex-row items-center justify-between gap-x-4 py-3">
            <div className="!font-medium mb-0 flex flex-row items-center gap-x-1 min-w-0">
              Allow notifications when you receive a reply in an ongoing action
              discussion?
              <InfoTooltip content="Keeping this enabled will send a text or email notification for specific discussions, like when you get an expert reply to a question you asked." />
            </div>
            <YesNoToggle
              value={!!editableUser.receiveReplyNotifications}
              onChange={(next) =>
                updateEditableUser({
                  receiveReplyNotifications: next,
                })
              }
              ariaLabel="Allow notifications when you receive a reply in an ongoing action discussion"
              yesLabel="On"
              noLabel="Off"
              className="shrink-0"
              yesColor={ButtonColor.Green}
            />
          </div>
        </div>
      </div>

      <p className="!font-medium mt-6 mb-2">Receive push notifications for:</p>
      <div className="flex flex-col divide-y divide-zinc-200 border-t border-zinc-200">
        <div className="flex flex-row items-center justify-between gap-x-4 py-3">
          <span className="font-medium">Likes</span>
          <YesNoToggle
            value={editableUser.pushesForLikes ?? false}
            onChange={(next) => updateEditableUser({ pushesForLikes: next })}
            ariaLabel="Push notifications for likes"
            yesLabel="On"
            noLabel="Off"
            yesColor={ButtonColor.Green}
          />
        </div>
        <div className="flex flex-row items-center justify-between gap-x-4 py-3">
          <span className="font-medium">Comments</span>
          <YesNoToggle
            value={editableUser.pushesForComments ?? false}
            onChange={(next) => updateEditableUser({ pushesForComments: next })}
            ariaLabel="Push notifications for comments"
            yesLabel="On"
            noLabel="Off"
            yesColor={ButtonColor.Green}
          />
        </div>
        <div className="flex flex-row items-center justify-between gap-x-4 py-3">
          <span className="font-medium">Friend requests</span>
          <YesNoToggle
            value={editableUser.pushesForFriendRequests ?? false}
            onChange={(next) =>
              updateEditableUser({ pushesForFriendRequests: next })
            }
            ariaLabel="Push notifications for friend requests"
            yesLabel="On"
            noLabel="Off"
            yesColor={ButtonColor.Green}
          />
        </div>
        <div className="flex flex-row items-center justify-between gap-x-4 py-3">
          <span className="font-medium">Messages</span>
          <YesNoToggle
            value={editableUser.pushesForMessages ?? false}
            onChange={(next) => updateEditableUser({ pushesForMessages: next })}
            ariaLabel="Push notifications for messages"
            yesLabel="On"
            noLabel="Off"
            yesColor={ButtonColor.Green}
          />
        </div>
        <div className="flex flex-row items-center justify-between gap-x-4 py-3">
          <span className="font-medium">Action updates</span>
          <YesNoToggle
            value={editableUser.pushesForActionUpdates ?? false}
            onChange={(next) =>
              updateEditableUser({ pushesForActionUpdates: next })
            }
            ariaLabel="Push notifications for action updates"
            yesLabel="On"
            noLabel="Off"
            yesColor={ButtonColor.Green}
          />
        </div>
      </div>

      <p className="!font-medium mt-6 mb-2">New group members</p>
      <div className="flex flex-col divide-y divide-zinc-200 border-t border-zinc-200">
        <div className="flex flex-row items-center justify-between gap-x-4 py-3">
          <span className="font-medium">Push</span>
          <YesNoToggle
            value={editableUser.pushesForNewGroupMembers ?? false}
            onChange={(next) =>
              updateEditableUser({ pushesForNewGroupMembers: next })
            }
            ariaLabel="Push notifications for new group members"
            yesLabel="On"
            noLabel="Off"
            yesColor={ButtonColor.Green}
          />
        </div>
        <div className="flex flex-row items-center justify-between gap-x-4 py-3">
          <span className="font-medium">Text/SMS</span>
          <YesNoToggle
            value={editableUser.textsForNewGroupMembers ?? false}
            onChange={(next) =>
              updateEditableUser({ textsForNewGroupMembers: next })
            }
            ariaLabel="Text/SMS notifications for new group members"
            yesLabel="On"
            noLabel="Off"
            yesColor={ButtonColor.Green}
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-y-2 gap-x-12 font-medium mt-6 pt-6 border-t border-zinc-200">
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
