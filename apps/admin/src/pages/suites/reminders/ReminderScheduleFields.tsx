import type {
  ReminderAnchorCandidateDto,
  ReminderGroupTimingMode,
} from "@alliance/shared/client";
import { formatDateTime } from "../../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import DateTimePicker, { timeZoneLabel } from "../../../ui/DateTimePicker";
import { Input } from "../../../ui/Input";
import { Select } from "../../../ui/Select";
import { Field } from "../../../ui/templates/Form";
import type { ReminderGroupDraft } from "./reminderGroupDraft";
import { anchorApplies } from "./reminderGroupRequest";

const ZONE = timeZoneLabel(LAUNCH_TIME_ZONE);

export const TIMING_MODE_LABELS: Record<ReminderGroupTimingMode, string> = {
  within_range: "Personalized window",
  absolute: "Absolute time",
  from_deadline: "Relative to deadline",
  within_relative_range: "Relative personalized window",
  event_launch: "Event launch",
};

const TIMING_MODE_HELP: Record<ReminderGroupTimingMode, string> = {
  within_range:
    "Each member gets it at their preferred reminder time, 7:00 PM in their own time zone if unset, on the first day it falls inside the window.",
  absolute: "Every member gets it at the same time.",
  from_deadline:
    "Every member gets it a set number of hours before the deadline.",
  within_relative_range:
    "Each member gets it at their preferred reminder time, 7:00 PM in their own time zone if unset, on the first day it falls inside a window set in hours before the deadline.",
  event_launch:
    "Sends when the members taking action event begins, as an announcement.",
};

type Hours =
  | "sendAtHoursFromDeadline"
  | "relativeRangeStartHours"
  | "relativeRangeEndHours";

const hoursValue = (value: string) => (value === "" ? NaN : Number(value));

export function ReminderScheduleFields({
  draft,
  anchorCandidates,
  rangeError,
  onChange,
}: {
  draft: ReminderGroupDraft;
  anchorCandidates: ReminderAnchorCandidateDto[];
  rangeError: string | null;
  onChange: (patch: Partial<ReminderGroupDraft>) => void;
}) {
  const { timingMode, timingAnchorEventId } = draft;
  // A set anchor no longer among the candidates would be submitted unseen and
  // refused, so the selector always shows it, as a stale option.
  const anchorIsStale =
    timingAnchorEventId !== null &&
    !anchorCandidates.some(
      (candidate) => candidate.deadlineEventId === timingAnchorEventId,
    );
  const hoursField = (field: Hours, label: string, error?: string | null) => (
    <Field label={label} error={error}>
      {(control) => (
        <Input
          {...control}
          type="number"
          min={field === "sendAtHoursFromDeadline" ? undefined : 0}
          value={Number.isNaN(draft[field]) ? "" : draft[field]}
          onChange={(event) =>
            onChange({ [field]: hoursValue(event.target.value) })
          }
        />
      )}
    </Field>
  );
  const anchorField = anchorApplies(timingMode) &&
    (anchorCandidates.length > 0 || timingAnchorEventId !== null) && (
      <Field
        label="Relative to"
        error={
          anchorIsStale
            ? "Pick another deadline: the current one is no longer a dependency of this task, so saving with it fails"
            : null
        }
      >
        {(control) => (
          <Select
            {...control}
            value={timingAnchorEventId ?? ""}
            onChange={(event) =>
              onChange({
                timingAnchorEventId: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
          >
            <option value="">This task&apos;s deadline</option>
            {anchorIsStale && (
              <option value={timingAnchorEventId}>
                Current anchor (no longer a dependency deadline)
              </option>
            )}
            {anchorCandidates.map((candidate) => (
              <option
                key={candidate.deadlineEventId}
                value={candidate.deadlineEventId}
              >
                {candidate.actionName} deadline,{" "}
                {formatDateTime(candidate.deadlineEventDate, {
                  timeZone: LAUNCH_TIME_ZONE,
                })}
              </option>
            ))}
          </Select>
        )}
      </Field>
    );
  const picker = (
    field: "sendAtAbsolute" | "sendRangeStart" | "sendRangeEnd",
    label: string,
  ) => (
    <Field label={`${label} (${ZONE})`}>
      {(control) => (
        <DateTimePicker
          {...control}
          timeZone={LAUNCH_TIME_ZONE}
          value={draft[field] || null}
          onChange={(change) => onChange({ [field]: change.utcValue ?? "" })}
        />
      )}
    </Field>
  );

  const modeFields: Record<ReminderGroupTimingMode, React.ReactNode> = {
    absolute: picker("sendAtAbsolute", "Send at"),
    from_deadline: (
      <>
        {hoursField("sendAtHoursFromDeadline", "Hours before the deadline")}
        {anchorField}
      </>
    ),
    within_range: (
      <div className="grid gap-4 @lg:grid-cols-2">
        {picker("sendRangeStart", "Window starts")}
        {picker("sendRangeEnd", "Window ends")}
      </div>
    ),
    within_relative_range: (
      <>
        {anchorField}
        <div className="grid gap-4 @lg:grid-cols-2">
          {hoursField(
            "relativeRangeStartHours",
            "Window starts (hours before the deadline)",
            rangeError,
          )}
          {hoursField(
            "relativeRangeEndHours",
            "Window ends (hours before the deadline)",
          )}
        </div>
      </>
    ),
    event_launch: null,
  };

  return (
    <>
      <Field label="Timing" help={TIMING_MODE_HELP[timingMode]}>
        {(control) => (
          <Select
            {...control}
            value={timingMode}
            onChange={(event) => {
              const mode = Object.keys(TIMING_MODE_LABELS).find(
                (key): key is ReminderGroupTimingMode =>
                  key === event.target.value,
              );
              if (mode) onChange({ timingMode: mode });
            }}
          >
            {Object.entries(TIMING_MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {modeFields[timingMode]}
    </>
  );
}
