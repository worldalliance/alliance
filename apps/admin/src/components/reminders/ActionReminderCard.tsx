import {
  PreviewNotificationPlan,
  ReminderGroup,
} from "@alliance/shared/client";
import Card from "@alliance/sharedweb/ui/Card";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import TextareaWithHighlights from "../TextareaWithHighlights";
import { ActionEventDto } from "@alliance/shared/client";
import { UserSelectUser } from "@alliance/sharedweb/ui/UserSelect";
import { TagDto } from "@alliance/shared/client";
import { ActionEventNotifDto } from "@alliance/shared/client";
import ActionReminderGroupForm, {
  ActionReminderGroupFormSubmitPayload,
} from "./ActionReminderGroupForm";
import DatabaseIcon from "@alliance/sharedweb/ui/icons/DatabaseIcon";
import { Link } from "react-router";
import { formatDate, formatDistanceToNow } from "date-fns";
import { useMemo, useRef, useState } from "react";
import DropdownIcon from "@alliance/sharedweb/ui/icons/DropdownIcon";
import { GroupScheduleLabels } from "./ActionRemindersTab";

interface ActionReminderCardProps {
  group: ReminderGroup;
  sendStartDate: Date | null;
  highlightedReminder: number | undefined;
  ref: React.RefObject<HTMLDivElement | null>;
  handleDeleteGroup: (
    groupId: number,
    anchor?: HTMLElement | null
  ) => Promise<void>;
  groupSchedule: GroupScheduleLabels;
  editing: boolean;
  handleEditCancel: () => void;
  handleEditGroupStart: (groupId: number) => void;
  selectedEventId: number | null;
  memberEvents: ActionEventDto[];
  users: UserSelectUser[];
  loadingUsers: boolean;
  userTags: TagDto[];
  loadingUserTags: boolean;
  userTagsError: string | null;
  editSubmitting: boolean;
  editError: string | null;
  editSuccess: string | null;
  handleEditGroupSubmit: (
    groupId: number
  ) => (payload: ActionReminderGroupFormSubmitPayload) => Promise<void>;
  reminderPlans?: PreviewNotificationPlan[];
  sentReminders?: ActionEventNotifDto[];
}
const ActionReminderCard = ({
  group,
  sendStartDate,
  highlightedReminder,
  ref,
  groupSchedule,
  editing,
  handleEditCancel,
  handleEditGroupStart,
  handleDeleteGroup,
  selectedEventId,
  memberEvents,
  users,
  loadingUsers,
  userTags,
  loadingUserTags,
  userTagsError,
  editSubmitting,
  editError,
  editSuccess,
  handleEditGroupSubmit,
  reminderPlans,
  sentReminders,
}: ActionReminderCardProps) => {
  const [minified, setMinified] = useState(true);
  const [showPlans, setShowPlans] = useState(false);
  const [showSentReminders, setShowSentReminders] = useState(false);

  const handleEditGroup = () => {
    setMinified(false);
    handleEditGroupStart(group.id);
  };

  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  const isFinished =
    reminderPlans && reminderPlans.length === 0 && sentReminders?.length;
  const relativeSendLabel = useMemo(() => {
    if (!sendStartDate) {
      return null;
    }
    return formatDistanceToNow(sendStartDate, { addSuffix: true });
  }, [sendStartDate]);

  return (
    <Card
      key={group.id}
      ref={highlightedReminder === group.id ? ref : undefined}
      className={`bg-white text-sm !p-0 overflow-hidden transition-all duration-300 ${
        highlightedReminder === group.id ? "!border-red-500" : ""
      }`}
    >
      <div className="flex flex-row gap-2 w-full bg-zinc-100 p-4 items-center justify-between">
        <div className="flex flex-row gap-4 items-center">
          <Button
            type="button"
            color={ButtonColor.Transparent}
            onClick={() => setMinified(!minified)}
            className={`!p-0 -my-1 transition-transform duration-100 ${
              minified ? "rotate-180" : ""
            }`}
          >
            <DropdownIcon size="small" fill="black" />
          </Button>
          <div className="flex flex-col gap-1">
            <div className="flex flex-row gap-2 items-center">
              {relativeSendLabel && (
                <p
                  className={`text-sm ${
                    isFinished ? "text-gray-500" : "text-blue-500"
                  }`}
                >
                  {relativeSendLabel}
                </p>
              )}
              <p
                className={`font-semibold ${isFinished ? "text-gray-500" : ""}`}
              >
                {group.name}
              </p>
              <Link
                to={`/database?table=reminder_group&id=${group.id}`}
                target="_blank"
              >
                <DatabaseIcon size="small" fill="#111" />
              </Link>
              {isFinished ? (
                <p className="text-green font-semibold">
                  Sent {sentReminders?.length} reminders{" "}
                  {groupSchedule.pastTense}
                </p>
              ) : (
                <p className="">{groupSchedule.primary}</p>
              )}
            </div>
            {groupSchedule.secondary && (
              <p className="text-xs text-gray-500">{groupSchedule.secondary}</p>
            )}
            {group.allSent && (
              <p className="text-green">All reminders processed</p>
            )}
          </div>
        </div>
        <div className="flex flex-row gap-2">
          {editing ? (
            <Button
              type="button"
              color={ButtonColor.White}
              onClick={handleEditCancel}
              className="-my-1"
            >
              Cancel
            </Button>
          ) : (
            !isFinished && (
              <Button
                type="button"
                color={ButtonColor.White}
                onClick={handleEditGroup}
                className="-my-1"
              >
                Edit
              </Button>
            )
          )}
          <Button
            type="button"
            color={ButtonColor.Black}
            onClick={() => handleDeleteGroup(group.id, deleteButtonRef.current)}
            className="-my-1"
            ref={deleteButtonRef}
          >
            Delete
          </Button>
        </div>
      </div>
      <div className={`${minified ? "hidden" : ""}`}>
        <div className={`flex flex-col gap-2 p-4`}>
          {editing && selectedEventId !== null ? (
            <ActionReminderGroupForm
              memberEvents={memberEvents}
              users={users}
              loadingUsers={loadingUsers}
              userTags={userTags}
              loadingUserTags={loadingUserTags}
              userTagsError={userTagsError}
              submitting={editSubmitting}
              initialValues={{
                memberActionEventId: selectedEventId,
                reminderGroup: group,
                users: group.users ?? [],
              }}
              serverError={editError}
              serverSuccess={editSuccess}
              submitLabel="Update Reminders"
              onCancel={handleEditCancel}
              onSubmit={handleEditGroupSubmit(group.id)}
            />
          ) : (
            <>
              <p className="text-sm font-semibold">Email message:</p>
              <Card className="flex flex-col gap-1 !p-2">
                <p className="text-sm font-semibold text-gray-900">
                  {group.emailSubject}
                </p>
                <TextareaWithHighlights
                  value={group.emailMessage}
                  editable={false}
                  onChange={() => {}}
                  keywords={[]}
                  textareaClassName="!border-0 border-transparent"
                />
              </Card>
              <p className="text-sm font-semibold">Text message:</p>
              <Card className="flex flex-col gap-1 !p-2">
                <p>{group.textMessage}</p>
              </Card>
              <p className="text-sm font-semibold">Push message:</p>
              <Card className="flex flex-col gap-1 !p-2">
                <p>{group.pushMessage}</p>
              </Card>
            </>
          )}
        </div>
        <div>
          <div className="flex flex-row gap-2">
            <p
              className="text-sm cursor-pointer ml-4 mb-4 text-blue"
              onClick={() => setShowPlans((prev) => !prev)}
            >
              {showPlans ? "Hide reminder plans" : "Show reminder plans"} (
              {reminderPlans?.length})
            </p>
            <p
              className="text-sm cursor-pointer ml-4 mb-4 text-green"
              onClick={() => setShowSentReminders((prev) => !prev)}
            >
              {showSentReminders
                ? "Hide sent reminders"
                : "Show sent reminders"}{" "}
              ({sentReminders?.length})
            </p>
          </div>
          <div
            className={`divide-y divide-gray-200 border-t border-gray-200 
                    overflow-y-auto transition-[max-height] duration-300 ${
                      showPlans ? "max-h-[300px]" : "max-h-[0px]"
                    }`}
          >
            {reminderPlans === undefined ? (
              <p className="text-sm text-zinc-500 p-5">
                Loading reminder plans...
              </p>
            ) : reminderPlans.length === 0 ? (
              <p className="text-sm text-zinc-500 p-5">No reminder plans</p>
            ) : (
              reminderPlans.map((plan) => (
                <div
                  key={plan.user.id}
                  className="p-3 flex flex-row gap-2 items-center"
                >
                  <Link to={`/member/${plan.user.id}`} target="_blank">
                    {plan.user.name}
                  </Link>
                  <p className="text-xs text-gray-500">
                    {formatDate(plan.scheduledFor, "MM/dd/yyyy hh:mm a")}
                  </p>
                  <p className="text-xs text-gray-500">({plan.channel})</p>
                </div>
              ))
            )}
          </div>
          <div
            className={`divide-y divide-gray-200 border-t border-gray-200 
                    overflow-y-auto transition-[max-height] duration-300 ${
                      showSentReminders ? "max-h-[300px]" : "max-h-[0px]"
                    }`}
          >
            {sentReminders === undefined ? (
              <p className="text-sm text-zinc-500 p-5">
                Loading sent reminders...
              </p>
            ) : sentReminders.length === 0 ? (
              <p className="text-sm text-zinc-500 p-5">No sent reminders</p>
            ) : (
              sentReminders.map((notif) => (
                <div
                  key={notif.id}
                  className="p-3 flex flex-row gap-2 items-center justify-between"
                >
                  <div className="flex flex-row gap-2 items-center">
                    <p className="text-zinc-500">({notif.channel})</p>
                    <Link to={`/member/${notif.user.id}`} target="_blank">
                      {notif.user.displayName}
                    </Link>
                    <p className="text-sm text-zinc-500">
                      {formatDate(notif.createdAt, "MM/dd/yyyy hh:mm a")}
                    </p>
                    <Link
                      to={`/database?table=action_event_notif&id=${notif.id}`}
                      target="_blank"
                    >
                      <DatabaseIcon size="small" fill="gray" />
                    </Link>
                  </div>
                  <p
                    className={`text-sm ${
                      notif.mms?.status === "undelivered"
                        ? "text-red-500"
                        : "text-zinc-500"
                    }`}
                  >
                    {notif.channel === "text"
                      ? notif.mms?.status
                      : notif.mail?.status}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ActionReminderCard;
