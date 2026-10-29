import type { CreateReminderGroupDto } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
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
  type RenderedReminder,
} from "./launchReminders";
import { inLaunchZone, type LaunchSchedule } from "./launchSchedule";
import type { ActionMix } from "./memberLoad";
import type { LaunchAction } from "./useSuiteLaunchData";

const RENDERED_FIELDS: [keyof RenderedReminder, string][] = [
  ["emailSubject", "Email subject"],
  ["emailMessage", "Email"],
  ["textMessage", "Text"],
  ["pushMessage", "Push"],
];

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
  const mixNames = (mix: ActionMix) =>
    mix.actionIds.map((id) => actionsById.get(id)?.name).join(", ");
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
        <label className="flex min-w-0 items-center gap-2 text-sm">
          Preview as
          <select
            value={mixIndex}
            onChange={(e) => setMixIndex(Number(e.target.value))}
            className="min-w-0 flex-1 truncate rounded border border-zinc-300 px-2 py-1 text-sm"
          >
            {mixes.map((option, index) => (
              <option key={option.actionIds.join(",")} value={index}>
                {mixNames(option)} ({option.userIds.length} members)
              </option>
            ))}
          </select>
        </label>
      )}
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
              <details>
                <summary
                  className={cn(
                    "flex cursor-pointer justify-between gap-4 py-0.5",
                    early.has(window) && "text-red-600",
                  )}
                >
                  <span>
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
                  <dl className="mb-2 ml-4 flex flex-col gap-2 border-l-2 border-zinc-200 pl-3">
                    <p className="text-xs text-zinc-500">
                      {body.cohortType === "group_leads_with_uncompleted"
                        ? `As ${sample.name} would get it leading a group with ${SAMPLE_GROUP_UNFINISHED} members still to finish`
                        : `As ${sample.name} gets it`}
                    </p>
                    {RENDERED_FIELDS.map(
                      ([field, label]) =>
                        rendered[field] && (
                          <div key={field}>
                            <dt className="text-xs text-zinc-500">{label}</dt>
                            <dd className="whitespace-pre-wrap">
                              {rendered[field]}
                            </dd>
                          </div>
                        ),
                    )}
                  </dl>
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
