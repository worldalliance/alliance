import type { ActionSuiteDto, ReminderGroupDto } from "@alliance/shared/client";
import { milliseconds } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { defaultReminderBodies } from "../../components/reminders/presets";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf } from "../../lib/formatNumber";
import { notifyRealMembersText } from "../../lib/notifyRealMembers";
import { useReminderGroupsForEvents } from "../../lib/useActionReminderGroupsAdmin";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { useReminderAnchorCandidatesAdmin } from "../../lib/useReminderAnchorCandidatesAdmin";
import { useTagsAdmin } from "../../lib/useTagsAdmin";
import { useUsersAdmin } from "../../lib/useUsersAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { Panel } from "../../ui/templates/Overview";
import { ContentState, TableSkeleton } from "../../ui/templates/States";
import { ConfirmMode, useToast } from "../../ui/ToastProvider";
import { useFocusAfterRemoval } from "../../ui/useFocusAfterRemoval";
import {
  ReminderGroupSheet,
  type SheetTarget,
} from "./reminders/ReminderGroupSheet";
import { ReminderGroupTable } from "./reminders/ReminderGroupTable";
import {
  deadlineAfter,
  defaultEventId,
  reminderEventIds,
  sortGroups,
  suiteMemberEvents,
} from "./reminders/suiteReminders";

/** The open sheet: `new`, or the id of the group being edited. */
export const GROUP_PARAM = "group";
const SHEET_OPENED_HERE = "reminderSheetOpenedHere";

// Outside development a group reaches real members, so it is confirmed with
// a typed phrase first.
const confirmsCreates = () => import.meta.env.MODE !== "development";

function useHighlight(reminder: number | null) {
  const [shown, setShown] = useState(reminder);
  useEffect(() => {
    setShown(reminder);
    if (reminder === null) return;
    const timer = setTimeout(
      () => setShown(null),
      milliseconds({ seconds: 2 }),
    );
    return () => clearTimeout(timer);
  }, [reminder]);
  return shown;
}

/**
 * Every reminder group of the suite, on whichever task's members taking
 * action event it hangs. `highlightedReminder`, from the timeline, is
 * scrolled to and marked for two seconds.
 */
export function SuiteRemindersTab({
  suite,
  highlightedReminder,
}: {
  suite: ActionSuiteDto;
  highlightedReminder: number | null;
}) {
  const highlighted = useHighlight(highlightedReminder);
  const confirm = useConfirmOnPage();
  const { success } = useToast();
  const memberEvents = useMemo(() => suiteMemberEvents(suite), [suite]);
  const eventIds = useMemo(() => reminderEventIds(suite), [suite]);
  const reminders = useReminderGroupsForEvents(eventIds);
  const { groups, detailsByGroup, create, update, remove } = reminders;
  const sorted = useMemo(
    () => sortGroups(suite, groups ?? []),
    [suite, groups],
  );
  const homeEvent = useMemo(
    () => defaultEventId(suite, groups ?? []),
    [suite, groups],
  );

  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const sheetParam = params.get(GROUP_PARAM);
  const editing = groups?.find((group) => String(group.id) === sheetParam);
  const target: SheetTarget | null =
    sheetParam === "new" && homeEvent !== null
      ? { kind: "create", eventId: homeEvent }
      : editing
        ? { kind: "edit", group: editing }
        : null;
  const [formEventId, setFormEventId] = useState<number | null>(null);
  const anchorEventId =
    target === null
      ? homeEvent
      : (formEventId ??
        (target.kind === "create"
          ? target.eventId
          : (target.group.memberActionEvent?.id ?? null)));
  const anchors = useReminderAnchorCandidatesAdmin(anchorEventId);
  const tags = useTagsAdmin();
  const users = useUsersAdmin();

  const openSheet = (value: string) => {
    setFormEventId(null);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(GROUP_PARAM, value);
        return next;
      },
      { state: { [SHEET_OPENED_HERE]: true } },
    );
  };
  // A sheet opened from the tab closes back to the tab's entry, so Back
  // doesn't land on the tab a second time; one opened by URL has none.
  const closeSheet = () => {
    if (
      typeof location.state === "object" &&
      location.state !== null &&
      SHEET_OPENED_HERE in location.state
    ) {
      void navigate(-1);
      return;
    }
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(GROUP_PARAM);
        return next;
      },
      { replace: true },
    );
  };

  const [writeError, setWriteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const removal = useFocusAfterRemoval({
    ids: useMemo(() => sorted.map((row) => row.group.id), [sorted]),
    fallback: newButton,
  });

  const populate = async () => {
    if (homeEvent === null) return;
    const task = memberEvents.find(({ event }) => event.id === homeEvent)?.task;
    const hasDeadline = deadlineAfter(task ?? null, homeEvent) !== null;
    const bodies = defaultReminderBodies({ suiteId: suite.id, hasDeadline });
    if (
      confirmsCreates() &&
      !(await confirm({
        title: "Populate default reminders?",
        message: `This creates ${countOf(bodies.length, "reminder group")} on ${task?.name ?? "this suite's task"}, which send reminders to its members${hasDeadline ? " and to their group leads" : ""}. A sent reminder can't be taken back.`,
        confirmLabel: "Create",
        mode: ConfirmMode.Fullscreen,
        requiredText: notifyRealMembersText("many"),
      }))
    ) {
      return;
    }
    setWriteError(null);
    setNotice(null);
    try {
      await create.mutateAsync({ eventId: homeEvent, bodies });
    } catch (error) {
      setWriteError(
        adminRefusalMessage(error, "Couldn't create the reminders."),
      );
      return;
    }
    if (hasDeadline) {
      success("Reminders created");
    } else {
      setNotice(
        "Created only the announcement: this event's task has no deadline after it, so there is nothing for the deadline reminders to count from.",
      );
    }
  };

  const createGroup = async ({
    payload,
    recipientCount,
    closeSaved,
  }: Parameters<
    React.ComponentProps<typeof ReminderGroupSheet>["onCreate"]
  >[0]) => {
    if (recipientCount === null) {
      throw new Error("create submitted before its recipient count arrived");
    }
    if (
      confirmsCreates() &&
      !(await confirm({
        title: "Create reminder group?",
        message: `This will send reminders by email, text or push to ${recipientCount} members.`,
        confirmLabel: "Create",
        mode: ConfirmMode.Fullscreen,
        requiredText: notifyRealMembersText(recipientCount),
      }))
    ) {
      return;
    }
    const { memberActionEventId: eventId, ...body } = payload;
    setFormError(null);
    try {
      await create.mutateAsync({
        eventId,
        bodies: [{ ...body, suiteId: suite.id }],
      });
    } catch (error) {
      setFormError(
        adminRefusalMessage(error, "Couldn't create the reminder group."),
      );
      return;
    }
    success("Reminder group created", body.name);
    closeSaved();
  };

  const updateGroup = async ({
    group,
    payload,
    closeSaved,
  }: Parameters<
    React.ComponentProps<typeof ReminderGroupSheet>["onUpdate"]
  >[0]) => {
    const { memberActionEventId: _eventId, ...body } = payload;
    setFormError(null);
    try {
      await update.mutateAsync({
        groupId: group.id,
        body: { ...body, suiteId: suite.id },
      });
    } catch (error) {
      setFormError(
        adminRefusalMessage(error, "Couldn't save the reminder group."),
      );
      return;
    }
    success("Reminder group saved", body.name);
    closeSaved();
  };

  const deleteGroup = async (group: ReminderGroupDto) => {
    const ok = await confirm({
      title: `Delete the reminder group “${group.name}”?`,
      message:
        "All planned reminders will no longer be sent. Reminders already sent stay sent.",
      confirmLabel: "Delete group",
      destructive: true,
    });
    if (!ok) return;
    const focusNext = removal.removing(group.id);
    setWriteError(null);
    setDeleting(group.id);
    try {
      await remove.mutateAsync(group.id);
    } catch (error) {
      setWriteError(
        adminRefusalMessage(error, "Couldn't delete the reminder group."),
      );
      return;
    } finally {
      setDeleting(null);
    }
    focusNext();
  };

  if (memberEvents.length === 0) {
    return (
      <Panel title="Reminders">
        <EmptyState
          title="No reminders yet"
          description="Reminders hang on a members taking action event, and no task in this suite has one. Launching the suite creates that event and the default reminders."
        />
      </Panel>
    );
  }

  const dismiss = (clear: () => void) => (
    <Button size="small" variant={ButtonVariant.Ghost} onClick={clear}>
      Dismiss
    </Button>
  );

  return (
    <>
      {writeError && (
        <Banner
          inline
          tone={BannerTone.Danger}
          action={dismiss(() => setWriteError(null))}
        >
          {writeError}
        </Banner>
      )}
      {notice && (
        <Banner
          inline
          tone={BannerTone.Warning}
          action={dismiss(() => setNotice(null))}
        >
          {notice}
        </Banner>
      )}
      {reminders.detailsLoadFailed && (
        <Banner inline tone={BannerTone.Warning}>
          Couldn&apos;t load some groups&apos; plans and sent reminders, so
          their state shows —.
        </Banner>
      )}
      {anchors.isError && (
        <Banner inline tone={BannerTone.Warning}>
          Couldn&apos;t load the dependency deadlines, so anchored groups
          don&apos;t name their task and the form can&apos;t offer them.
        </Banner>
      )}
      <Panel
        title="Reminders"
        flush
        action={
          <span className="flex gap-2">
            {groups?.length === 0 && (
              <Button
                size="small"
                variant={ButtonVariant.Default}
                onClick={() => void populate()}
                busy={create.isPending && sheetParam === null}
              >
                Populate default reminders
              </Button>
            )}
            <Button
              ref={newButton}
              size="small"
              variant={ButtonVariant.Default}
              onClick={() => openSheet("new")}
            >
              New reminder
            </Button>
          </span>
        }
      >
        <ContentState
          things="reminders"
          query={reminders.groupsQuery}
          skeleton={<TableSkeleton columns={7} rows={3} />}
          empty={sorted.length === 0}
          emptyTitle="No reminders yet"
          emptyDescription="Populate default reminders adds the standard set; New reminder adds one."
        >
          <ReminderGroupTable
            suite={suite}
            groups={sorted}
            detailsByGroup={detailsByGroup}
            anchorCandidates={anchors.data ?? []}
            highlighted={highlighted}
            deleting={deleting}
            focusRow={removal.row}
            onEdit={(group) => openSheet(String(group.id))}
            onDelete={(group) => void deleteGroup(group)}
          />
        </ContentState>
      </Panel>
      {target && (
        <ReminderGroupSheet
          key={sheetParam}
          target={target}
          anchorCandidates={anchors.data ?? []}
          onClose={() => {
            setFormError(null);
            closeSheet();
          }}
          onCreate={createGroup}
          onUpdate={updateGroup}
          form={{
            suiteId: suite.id,
            memberEvents,
            users: users.data ?? [],
            loadingUsers: users.isLoading,
            usersLoadFailed: users.isLoadingError,
            userTags: tags.tags,
            loadingUserTags: tags.isLoading,
            userTagsError: tags.isError ? "Couldn't load user tags." : null,
            submitting:
              target.kind === "edit" ? update.isPending : create.isPending,
            serverError: formError,
            onEventChange: setFormEventId,
          }}
        />
      )}
    </>
  );
}
