import {
  ActionEventDto,
  ActionEventNotifDto,
  actionsPreviewEmailHtmlAdmin,
  actionsPreviewTextMessageAdmin,
  PreviewNotificationPlanDto,
  ReminderAnchorCandidateDto,
  ReminderGroupDto,
  TagDto,
} from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import DatabaseIcon from "@alliance/sharedweb/ui/icons/DatabaseIcon";
import DropdownIcon from "@alliance/sharedweb/ui/icons/DropdownIcon";
import { UserSelectUser } from "@alliance/sharedweb/ui/UserSelect";
import { formatDate, formatDistanceToNow } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import TextareaWithHighlights from "../TextareaWithHighlights";
import ActionReminderGroupForm, {
  ActionReminderGroupFormSubmitPayload,
} from "./ActionReminderGroupForm";
import { GroupScheduleLabels } from "./ActionRemindersTab";

interface ActionReminderCardProps {
  group: ReminderGroupDto;
  sendStartDate: Date | null;
  highlightedReminder: number | undefined;
  ref: React.RefObject<HTMLDivElement | null>;
  handleDeleteGroup: (
    groupId: number,
    anchor?: HTMLElement | null,
  ) => Promise<void>;
  groupSchedule: GroupScheduleLabels;
  editing: boolean;
  handleEditCancel: () => void;
  handleEditGroupStart: (groupId: number) => void;
  selectedEventId: number | null;
  memberEvents: ActionEventDto[];
  anchorCandidates: ReminderAnchorCandidateDto[];
  users: UserSelectUser[];
  loadingUsers: boolean;
  userTags: TagDto[];
  loadingUserTags: boolean;
  userTagsError: string | null;
  editSubmitting: boolean;
  editError: string | null;
  editSuccess: string | null;
  handleEditGroupSubmit: (
    groupId: number,
  ) => (payload: ActionReminderGroupFormSubmitPayload) => Promise<void>;
  reminderPlans?: PreviewNotificationPlanDto[];
  sentReminders?: ActionEventNotifDto[];
  suiteTaskCount: number;
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
  anchorCandidates,
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
  suiteTaskCount,
}: ActionReminderCardProps) => {
  const [minified, setMinified] = useState(true);
  const [showPlans, setShowPlans] = useState(false);
  const [showSentReminders, setShowSentReminders] = useState(false);

  const [emailPreview, setEmailPreview] = useState<{
    subject: string;
    html: string;
  } | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [pushPreview, setPushPreview] = useState<string | null>(null);
  const eventId = group.memberActionEvent?.id;

  useEffect(() => {
    if (editing || minified || eventId == null) {
      setEmailPreview(null);
      setTextPreview(null);
      setPushPreview(null);
      return;
    }
    let ignored = false;
    actionsPreviewEmailHtmlAdmin({
      path: { eventId },
      body: {
        emailMessage: group.emailMessage,
        emailSubject: group.emailSubject,
        taskCount: suiteTaskCount,
        cohortType: group.cohortType,
      },
    }).then((res) => {
      if (ignored) {
        return;
      }
      if (!res.error && res.data) {
        setEmailPreview({
          subject: res.data.subject,
          html: res.data.html,
        });
      }
    });
    actionsPreviewTextMessageAdmin({
      path: { eventId },
      body: {
        textMessage: group.textMessage,
        taskCount: suiteTaskCount,
        cohortType: group.cohortType,
      },
    }).then((res) => {
      if (ignored) {
        return;
      }
      if (!res.error && res.data) {
        setTextPreview(res.data.text);
      }
    });
    actionsPreviewTextMessageAdmin({
      path: { eventId },
      body: {
        textMessage: group.pushMessage,
        taskCount: suiteTaskCount,
        cohortType: group.cohortType,
      },
    }).then((res) => {
      if (ignored) {
        return;
      }
      if (!res.error && res.data) {
        setPushPreview(res.data.text);
      }
    });
    return () => {
      ignored = true;
    };
  }, [
    editing,
    minified,
    eventId,
    group.emailMessage,
    group.emailSubject,
    group.textMessage,
    group.pushMessage,
    group.cohortType,
    suiteTaskCount,
  ]);

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
      className={cn(
        "bg-white text-sm !p-0 overflow-hidden transition-all duration-300",
        highlightedReminder === group.id && "!border-red-500",
      )}
    >
      <div className="flex flex-row gap-2 w-full bg-zinc-100 p-4 items-center justify-between">
        <div className="flex flex-row gap-4 items-center">
          <Button
            type="button"
            color={ButtonColor.Transparent}
            onClick={() => setMinified(!minified)}
            className={cn(
              "!p-2 -my-1 transition-transform duration-100",
              minified && "rotate-180",
            )}
          >
            <DropdownIcon size="small" fill="black" />
          </Button>
          <div className="flex flex-col gap-1">
            <div className="flex flex-row gap-2 items-center">
              {relativeSendLabel && (
                <p
                  className={cn(
                    "text-sm",
                    isFinished ? "text-gray-500" : "text-blue-500",
                  )}
                >
                  {relativeSendLabel}
                </p>
              )}
              <p className={cn("font-semibold", isFinished && "text-gray-500")}>
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
            {group.timingAnchorEvent && (
              <p className="text-xs text-gray-500">
                Anchored to:{" "}
                {anchorCandidates.find(
                  (candidate) =>
                    candidate.deadlineEventId === group.timingAnchorEvent?.id,
                )?.actionName ?? "dependency action"}{" "}
                deadline
              </p>
            )}
            {group.excludePreviouslyNotified && (
              <p className="text-xs text-gray-500">
                Only covers tasks the user hasn&apos;t been notified about;
                skips users with nothing new
              </p>
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
      <div className={cn(minified && "hidden")}>
        <div className="flex flex-col gap-2 p-4">
          {editing && selectedEventId !== null ? (
            <ActionReminderGroupForm
              memberEvents={memberEvents}
              anchorCandidates={anchorCandidates}
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
                {emailPreview && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-sm font-semibold text-gray-900">
                      {emailPreview.subject}
                    </p>
                    <div
                      className="text-sm text-gray-700 whitespace-pre-wrap break-words"
                      dangerouslySetInnerHTML={{ __html: emailPreview.html }}
                    />
                  </div>
                )}
              </Card>
              <p className="text-sm font-semibold">Text message:</p>
              <Card className="flex flex-col gap-1 !p-2">
                <p>{group.textMessage}</p>
                {textPreview != null && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                      {textPreview}
                    </p>
                  </div>
                )}
              </Card>
              <p className="text-sm font-semibold">Push message:</p>
              <Card className="flex flex-col gap-1 !p-2">
                <p>{group.pushMessage}</p>
                {pushPreview != null && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                      {pushPreview}
                    </p>
                  </div>
                )}
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
            className={cn(
              "divide-y divide-gray-200 border-t border-gray-200 overflow-y-auto transition-[max-height] duration-300",
              showPlans ? "max-h-[300px]" : "max-h-[0px]",
            )}
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
                  <p className="text-xs text-gray-500">
                    ({plan.channels.join(", ")})
                  </p>
                </div>
              ))
            )}
          </div>
          <div
            className={cn(
              "divide-y divide-gray-200 border-t border-gray-200 overflow-y-auto transition-[max-height] duration-300",
              showSentReminders ? "max-h-[300px]" : "max-h-0",
            )}
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
                    <p className="text-zinc-500">
                      {notif.mms && "text "}
                      {notif.mail && "email "}
                      {notif.pushes?.length ? "push " : null}
                    </p>
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
                    className={cn(
                      "text-sm",
                      notif.mms?.status === "undelivered"
                        ? "text-red-500"
                        : "text-zinc-500",
                    )}
                  >
                    {notif.mms ? `text: ${notif.mms.status} ` : null}
                    {notif.mail ? `email: ${notif.mail.status} ` : null}
                    {notif.pushes?.length
                      ? `push: ${notif.pushes[0].receiptStatus}`
                      : null}
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
