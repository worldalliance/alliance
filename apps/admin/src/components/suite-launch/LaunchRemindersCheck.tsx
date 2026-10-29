import { withCount } from "@alliance/common/plural";
import type { CreateReminderGroupDto } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { getSiteUrl } from "../../lib/config";
import { useUsersAdmin } from "../../lib/useUsersAdmin";
import { LaunchSection } from "./launchBlockers";
import LaunchCheck from "./LaunchCheck";
import {
  nightRecipientCount,
  remindersBeforeLaunch,
  renderLaunchReminder,
  SAMPLE_GROUP_UNFINISHED,
  type ReminderSendWindow,
} from "./launchReminders";
import { inLaunchZone, type LaunchSchedule } from "./launchSchedule";
import type { ActionMix } from "./memberLoad";
import { EmailMockup, PushMockup, TextMockup } from "./MessageMockups";
import type { LaunchAction } from "./useSuiteLaunchData";

const LaunchRemindersCheck = ({
  bodies,
  windows,
  schedule,
  timeZones,
  mixes,
  actions,
}: {
  bodies: CreateReminderGroupDto[];
  /** One per body, in the same order. */
  windows: ReminderSendWindow[];
  schedule: LaunchSchedule;
  /** Recipients' saved zones, null when unset. */
  timeZones: readonly (string | null)[];
  mixes: ActionMix[];
  actions: LaunchAction[];
}) => {
  const { data: users = [] } = useUsersAdmin();
  const [mixIndex, setMixIndex] = useState(0);
  const actionsById = new Map(actions.map(({ action }) => [action.id, action]));
  const mix = mixes.at(mixIndex) ?? mixes.at(0);
  const sampleId = mix?.userIds[0];
  const sample = users.find((user) => user.id === sampleId);
  const links = {
    tasks: `${getSiteUrl()}/tasks`,
    groupMembers: `${getSiteUrl()}/groups?tab=members`,
  };

  const reminders = bodies
    .map((body, index) => ({ body, window: windows[index] }))
    .sort((a, b) => a.window.start.getTime() - b.window.start.getTime());
  const early = new Set(remindersBeforeLaunch(windows, schedule));
  const nightCounts = new Map(
    windows.map((window) => [
      window,
      nightRecipientCount({ window, timeZones }),
    ]),
  );
  const atNight = windows.filter((window) => nightCounts.get(window)).length;
  return (
    <LaunchCheck
      id={LaunchSection.Reminders}
      title="Reminders"
      passed={early.size === 0}
      summary={`${windows.length} created on launch${atNight > 0 ? ` · ${atNight} reach some members at night` : ""}`}
    >
      {mixes.length > 0 && (
        <div className="flex flex-col gap-2">
          <p id="reminder-preview-as" className="text-sm">
            Preview as
          </p>
          <div
            role="radiogroup"
            aria-labelledby="reminder-preview-as"
            className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3"
          >
            {mixes.map((option, index) => (
              <button
                key={option.actionIds.join(",")}
                type="button"
                role="radio"
                aria-checked={mix === option}
                onClick={() => setMixIndex(index)}
                className={cn(
                  "flex flex-col justify-start gap-1 rounded-lg border-2 bg-white p-3 text-left text-xs",
                  mix === option
                    ? "border-green"
                    : "border-zinc-200 hover:border-zinc-400",
                )}
              >
                <span className="mb-1 block text-sm font-medium">
                  {withCount(option.userIds.length, "member")} ·{" "}
                  {withCount(option.actionIds.length, "task")} ·{" "}
                  {option.minutes} min
                </span>
                {option.actionIds.map((id) => (
                  <span key={id} className="block text-zinc-600">
                    {actionsById.get(id)?.name}
                  </span>
                ))}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-zinc-500">
        Click a reminder to see it as these members get it
      </p>
      <ul className="text-sm">
        {reminders.map(({ body, window }) => {
          const rendered =
            mix && sample
              ? renderLaunchReminder({
                  body,
                  window,
                  schedule,
                  member: sample,
                  memberActions: mix.actionIds.flatMap((id) => {
                    const action = actionsById.get(id);
                    return action ? [action] : [];
                  }),
                  suiteActionName: actions.at(0)?.action.name ?? "",
                  links,
                })
              : null;
          return (
            <li key={window.name}>
              <details className="group">
                <summary
                  className={cn(
                    "flex cursor-pointer list-none justify-between gap-4 rounded px-1 py-1.5 hover:bg-zinc-100 [&::-webkit-details-marker]:hidden",
                    early.has(window) && "text-red-600",
                  )}
                >
                  <span className="flex items-center gap-1">
                    <ChevronRight
                      className="size-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-90"
                      aria-hidden
                    />
                    {window.name}
                    {!!nightCounts.get(window) && (
                      <span className="ml-2 text-xs text-yellow-700">
                        Reaches {nightCounts.get(window)} members between 10pm
                        and 8am their time
                      </span>
                    )}
                  </span>
                  <span className="text-zinc-500">
                    {inLaunchZone(window.start)}
                    {window.end.getTime() !== window.start.getTime() &&
                      ` – ${inLaunchZone(window.end)}`}
                  </span>
                </summary>
                {rendered && sample ? (
                  <div className="my-3 ml-4 flex flex-col gap-4 border-l-2 border-zinc-200 pl-3">
                    <p className="text-xs text-zinc-500">
                      {body.cohortType === "group_leads_with_uncompleted"
                        ? `As ${sample.name} would get it leading a group with ${SAMPLE_GROUP_UNFINISHED} members still to finish`
                        : `As ${sample.name} gets it`}
                    </p>
                    {rendered.emailMessage && (
                      <EmailMockup
                        subject={rendered.emailSubject}
                        body={rendered.emailMessage}
                        recipient={sample.name}
                      />
                    )}
                    <div className="flex flex-col items-start gap-4">
                      {rendered.textMessage && (
                        <TextMockup message={rendered.textMessage} />
                      )}
                      {rendered.pushMessage && (
                        <PushMockup message={rendered.pushMessage} />
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="mb-2 ml-4 text-xs text-zinc-500">
                    The preview appears once members load.
                  </p>
                )}
              </details>
            </li>
          );
        })}
      </ul>
    </LaunchCheck>
  );
};

export default LaunchRemindersCheck;
