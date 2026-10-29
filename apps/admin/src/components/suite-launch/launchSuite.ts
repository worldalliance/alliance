import { R, type Result } from "@alliance/common/result";
import type {
  ActionSuiteDto,
  CreateActionEventDto,
  CreateReminderGroupDto,
} from "@alliance/shared/client";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { defaultEventNames } from "../CreateEventForm";
import { defaultReminderBodies } from "../reminders/presets";
import { existingLaunchEvent } from "./launchBlockers";
import type { LaunchSchedule } from "./launchSchedule";

/**
 * A React Query refetch resolves even when it fails, with the cached data
 * still attached; a launch must not check against that stale copy.
 */
export async function refetchedOrThrow<T>(
  refetch: () => Promise<{
    data: T | undefined;
    isError: boolean;
    error: unknown;
  }>,
): Promise<T> {
  const result = await refetch();
  if (result.isError || result.data === undefined) {
    throw result.error ?? new Error("The reload returned nothing.");
  }
  return result.data;
}

export async function launchSuite(params: {
  suiteId: number;
  /** Reads the suite fresh, so a launch from another tab or person shows. */
  fetchSuite: () => Promise<Pick<ActionSuiteDto, "events">>;
  schedule: LaunchSchedule;
  /** Resolves `null` when staff decline to move a deadline earlier. */
  addEvent: (body: CreateActionEventDto) => Promise<ActionSuiteDto | null>;
  createReminders: (params: {
    eventId: number;
    bodies: CreateReminderGroupDto[];
  }) => Promise<unknown>;
}): Promise<Result<void, string>> {
  const { suiteId, fetchSuite, schedule, addEvent, createReminders } = params;
  const latest = await R.fromPromise(fetchSuite());
  if (!latest.ok) {
    return R.failure(
      `${adminRefusalMessage(latest.error, "Couldn't reload the suite to check it hasn't already launched")}. Nothing was launched.`,
    );
  }
  if (
    latest.value.events.some((event) => event.newStatus === "member_action")
  ) {
    return R.failure(
      "Someone launched this suite since this page loaded. Nothing was created.",
    );
  }
  const existing = existingLaunchEvent(latest.value.events);
  if (existing) return R.failure(`${existing} Nothing was created.`);
  const existingEventIds = new Set(
    latest.value.events.map((event) => event.id),
  );

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
      bodies: defaultReminderBodies({ suiteId, hasDeadline: true }),
    }),
  );
  if (!reminders.ok) {
    return R.failure(
      `Created both events, but not all default reminders (${adminRefusalMessage(reminders.error, "they failed")}). Add the missing ones in Reminders on the suite page.`,
    );
  }
  return R.success(undefined);
}
