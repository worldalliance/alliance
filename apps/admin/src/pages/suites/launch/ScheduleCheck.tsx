import { LaunchSection } from "../../../components/suite-launch/launchBlockers";
import {
  completionTime,
  type LaunchSchedule,
} from "../../../components/suite-launch/launchSchedule";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import DateTimePicker, { timeZoneLabel } from "../../../ui/DateTimePicker";
import { Field } from "../../../ui/templates/Form";
import { LaunchCheck } from "./LaunchCheck";

const ZONE = timeZoneLabel(LAUNCH_TIME_ZONE);

const FIELDS: {
  key: keyof LaunchSchedule;
  label: string;
  help: string;
  /** Which of `scheduleProblems`' messages belongs under this field. */
  problem: string;
}[] = [
  {
    key: "memberActionAt",
    label: `Members taking action (${ZONE})`,
    help: "From then, members can see and start the tasks.",
    problem: "Members taking action must start in the future.",
  },
  {
    key: "officeActionAt",
    label: `Office taking action (${ZONE})`,
    help: "Members' deadline. Staff act from then.",
    problem: "Office taking action must come after members start.",
  },
];

export function ScheduleCheck({
  schedule,
  problems,
  eventInWindow,
  onChange,
}: {
  schedule: LaunchSchedule;
  /** `scheduleProblems` for now. */
  problems: string[];
  /** `eventBeforeDeadline`'s message, if the suite has such an event. */
  eventInWindow: string | null;
  onChange: (field: keyof LaunchSchedule, at: Date) => void;
}) {
  const valid = problems.length === 0;
  return (
    <LaunchCheck
      id={LaunchSection.Schedule}
      title="Schedule"
      passed={valid && eventInWindow === null}
      summary="Every task in the suite gets these two events"
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 @2xl:grid-cols-2">
          {FIELDS.map(({ key, label, help, problem }) => (
            <Field
              key={key}
              label={label}
              help={help}
              error={problems.includes(problem) ? problem : null}
            >
              {(control) => (
                <DateTimePicker
                  {...control}
                  timeZone={LAUNCH_TIME_ZONE}
                  value={schedule[key]}
                  onChange={({ utcValue }) => {
                    if (utcValue) onChange(key, new Date(utcValue));
                  }}
                />
              )}
            </Field>
          ))}
        </div>
        {valid && (
          <p>
            Members have {completionTime(schedule)} to complete their tasks
          </p>
        )}
        {eventInWindow && <p className="text-danger">{eventInWindow}</p>}
      </div>
    </LaunchCheck>
  );
}
