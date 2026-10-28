import { R, type Result } from "@alliance/common/result";
import type {
  ActionSuiteDto,
  CreateActionEventDto,
  CreateReminderGroupDto,
} from "@alliance/shared/client";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { defaultEventNames } from "../CreateEventForm";
import { defaultReminderBodies } from "../reminders/presets";
import type { LaunchSchedule } from "./launchSchedule";

export async function launchSuite(params: {
  suite: Pick<ActionSuiteDto, "id" | "events">;
  schedule: LaunchSchedule;
  /** Resolves `null` when staff decline to move a deadline earlier. */
  addEvent: (body: CreateActionEventDto) => Promise<ActionSuiteDto | null>;
  createReminders: (params: {
    eventId: number;
    bodies: CreateReminderGroupDto[];
  }) => Promise<unknown>;
}): Promise<Result<void, string>> {
  const { suite, schedule, addEvent, createReminders } = params;
  const existingEventIds = new Set(suite.events.map((event) => event.id));

  const withMemberEvent = await R.fromPromise(
    addEvent({
      title: defaultEventNames.member_action,
      description: "",
      newStatus: "member_action",
      date: schedule.memberActionAt.toISOString(),
    }),
  );
  if (!withMemberEvent.ok) {
    return R.failure(
      `${adminRefusalMessage(withMemberEvent.error, "Failed to create the member action event")}. Nothing was launched.`,
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
      "Created the member action event but couldn't find it on the suite. Reload, then add the office action event and default reminders by hand.",
    );
  }

  const withOfficeEvent = await R.fromPromise(
    addEvent({
      title: defaultEventNames.office_action,
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
      `Created the member action event, but not the office action event (${reason}). Add it and the default reminders by hand.`,
    );
  }

  const reminders = await R.fromPromise(
    createReminders({
      eventId: memberEvent.id,
      bodies: defaultReminderBodies({ suiteId: suite.id, hasDeadline: true }),
    }),
  );
  if (!reminders.ok) {
    return R.failure(
      `Created both events, but not all default reminders (${adminRefusalMessage(reminders.error, "they failed")}). Check the reminders below and add the missing ones.`,
    );
  }
  return R.success(undefined);
}
