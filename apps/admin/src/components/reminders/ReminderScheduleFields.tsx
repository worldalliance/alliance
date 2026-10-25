import type { ReminderAnchorCandidateDto } from "@alliance/shared/client";
import DateTimePicker from "@alliance/sharedweb/ui/DateTimePicker";
import React from "react";
import type { ReminderGroupDraft } from "./reminderGroupDraft";
import { anchorApplies } from "./reminderGroupRequest";

interface ReminderScheduleFieldsProps {
  draft: Pick<
    ReminderGroupDraft,
    | "timingMode"
    | "sendAtAbsolute"
    | "sendAtHoursFromDeadline"
    | "sendRangeStart"
    | "sendRangeEnd"
    | "relativeRangeStartHours"
    | "relativeRangeEndHours"
    | "timingAnchorEventId"
  >;
  anchorCandidates: ReminderAnchorCandidateDto[];
  onChange: (patch: Partial<ReminderGroupDraft>) => void;
}

const ReminderScheduleFields: React.FC<ReminderScheduleFieldsProps> = ({
  draft,
  anchorCandidates,
  onChange,
}) => {
  const {
    timingMode,
    sendAtAbsolute,
    sendAtHoursFromDeadline,
    sendRangeStart,
    sendRangeEnd,
    relativeRangeStartHours,
    relativeRangeEndHours,
    timingAnchorEventId,
  } = draft;

  // A set anchor that is no longer among the candidates (the dependency was
  // removed from the cohort expression, or the fetch failed) would otherwise
  // be submitted invisibly and rejected by the server with no way to clear
  // it — always show the selector then, with an explicit stale option.
  const anchorIsStale =
    timingAnchorEventId !== null &&
    !anchorCandidates.some(
      (candidate) => candidate.deadlineEventId === timingAnchorEventId,
    );
  const anchorSelector = anchorApplies(timingMode) &&
    (anchorCandidates.length > 0 || timingAnchorEventId !== null) && (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Relative to
        </label>
        <select
          value={timingAnchorEventId ?? ""}
          onChange={(event) =>
            onChange({
              timingAnchorEventId: event.target.value
                ? Number(event.target.value)
                : null,
            })
          }
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">This action&apos;s deadline</option>
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
              {candidate.actionName} deadline —{" "}
              {new Date(candidate.deadlineEventDate).toLocaleString()}
            </option>
          ))}
        </select>
        {anchorIsStale && (
          <p className="text-xs text-amber-600 mt-1">
            The current anchor is no longer a dependency deadline of this
            action; saving with it will fail. Pick another option.
          </p>
        )}
      </div>
    );

  return (
    <>
      {timingMode === "absolute" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Send at
          </label>
          <DateTimePicker
            value={sendAtAbsolute}
            onChange={(change) =>
              onChange({ sendAtAbsolute: change.utcValue ?? "" })
            }
            className="w-full !py-1"
            required
          />
        </div>
      )}

      {timingMode === "from_deadline" && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              hours to deadline
            </label>
            <input
              type="number"
              value={sendAtHoursFromDeadline}
              onChange={(event) => {
                const value = event.target.value;
                onChange({
                  sendAtHoursFromDeadline: value === "" ? NaN : Number(value),
                });
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          {anchorSelector}
        </>
      )}

      {timingMode === "within_range" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Send range start
            </label>
            <DateTimePicker
              value={sendRangeStart}
              onChange={(change) =>
                onChange({ sendRangeStart: change.utcValue ?? "" })
              }
              className="w-full !py-1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Send range end
            </label>
            <DateTimePicker
              value={sendRangeEnd}
              onChange={(change) =>
                onChange({ sendRangeEnd: change.utcValue ?? "" })
              }
              className="w-full !py-1"
              required
            />
          </div>
        </div>
      )}

      {timingMode === "within_relative_range" && (
        <div className="grid gap-4 md:grid-cols-2">
          {anchorSelector && (
            <div className="md:col-span-2">{anchorSelector}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Window starts (hours before deadline)
            </label>
            <input
              type="number"
              value={relativeRangeStartHours}
              min={0}
              onChange={(event) => {
                const value = event.target.value;
                onChange({
                  relativeRangeStartHours: value === "" ? NaN : Number(value),
                });
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Window ends (hours before deadline)
            </label>
            <input
              type="number"
              value={relativeRangeEndHours}
              min={0}
              onChange={(event) => {
                const value = event.target.value;
                onChange({
                  relativeRangeEndHours: value === "" ? NaN : Number(value),
                });
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      {timingMode === "event_launch" && (
        <p className="text-sm text-gray-600">
          Reminders send when the member action event begins (i.e. announcement)
        </p>
      )}
    </>
  );
};

export default ReminderScheduleFields;
