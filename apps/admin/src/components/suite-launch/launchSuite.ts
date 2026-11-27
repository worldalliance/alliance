import { R, type Result } from "@alliance/common/result";
import type {
  ActionSuiteDto,
  CreateActionEventDto,
  CreateReminderGroupDto,
} from "@alliance/shared/client";
import { DEFAULT_EVENT_NAMES } from "../../lib/actionStatusDisplay";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { fromApi } from "../../lib/fromApi";
import { eventBeforeDeadline, existingLaunchEvent } from "./launchBlockers";
import type { LaunchSchedule } from "./launchSchedule";

export async function launchSuite(params: {
  /** Reads the suite fresh, so a launch from another tab or person shows. */
  fetchSuite: () => Promise<Result<Pick<ActionSuiteDto, "events">, unknown>>;
  schedule: LaunchSchedule;
  reminderBodies: CreateReminderGroupDto[];
  /** Resolves `null` when staff decline to move a deadline earlier. */
  addEvent: (body: CreateActionEventDto) => Promise<ActionSuiteDto | null>;
  createReminders: (params: {
    eventId: number;
    bodies: CreateReminderGroupDto[];
  }) => Promise<unknown>;
}): Promise<Result<void, string>> {
  const { fetchSuite, schedule, addEvent, reminderBodies, createReminders } =
    params;
  const latest = await fetchSuite();
  if (!latest.ok) {
    return R.failure(
      `${adminRefusalMessage(latest.error, "Couldn't reload the suite to check it hasn't already launched")}. Nothing was launched.`,
    );
  }
  const existing =
    existingLaunchEvent(latest.value.events) ??
    eventBeforeDeadline(latest.value.events, schedule);
  if (existing) {
    return R.failure(
      `Someone changed this suite since the page loaded. ${existing} Nothing was created.`,
    );
  }
  const existingEventIds = new Set(
    latest.value.events.map((event) => event.id),
  );

  const withMemberEvent = await fromApi(
    addEvent({
      title: DEFAULT_EVENT_NAMES.member_action,
      description: "",
      newStatus: "member_action",
      date: schedule.memberActionAt.toISOString(),
    }),
  );
  if (!withMemberEvent.ok) {
    return R.failure(
      `${adminRefusalMessage(withMemberEvent.error, "Couldn't create the members taking action event")}. Nothing was launched.`,
    );
  }
  if (!withMemberEvent.value) {
    return R.failure("Launch cancelled. Nothing was created.");
  }
  const memberEvent = withMemberEvent.value.events.find(
    (event) =>
      event.newStatus === "member_action" && !existingEventIds.has(event.id),
  );
  if (!memberEvent) {
    return R.failure(
      "Created the members taking action event but couldn't find it on the suite. Reload, then add the office taking action event and default reminders by hand.",
    );
  }

  const withOfficeEvent = await fromApi(
    addEvent({
      title: DEFAULT_EVENT_NAMES.office_action,
      description: "",
      newStatus: "office_action",
      date: schedule.officeActionAt.toISOString(),
    }),
  );
  if (!withOfficeEvent.ok || !withOfficeEvent.value) {
    const reason = withOfficeEvent.ok
      ? "it was cancelled"
      : adminRefusalMessage(withOfficeEvent.error, "it failed");
    return R.failure(
      `Created the members taking action event, but not the office taking action event (${reason}). Add it and the default reminders by hand.`,
    );
  }

  const reminders = await fromApi(
    createReminders({
      eventId: memberEvent.id,
      bodies: reminderBodies,
    }),
  );
  if (!reminders.ok) {
    return R.failure(
      `Created both events, but not all default reminders (${adminRefusalMessage(reminders.error, "they failed")}). Add the missing ones on the suite's Reminders tab.`,
    );
  }
  return R.success(undefined);
}
