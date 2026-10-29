import { withCount } from "@alliance/common/plural";
import type { CreateReminderGroupDto, UserDto } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import { useState } from "react";
import { getSiteUrl } from "../../lib/config";
import Disclosure from "../Disclosure";
import { SelectableCard, SelectableCardGroup } from "../SelectableCards";
import { LaunchSection } from "./launchBlockers";
import LaunchCheck from "./LaunchCheck";
import {
  nightRecipientCount,
  remindersBeforeLaunch,
  reminderVariants,
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
  users,
}: {
  bodies: CreateReminderGroupDto[];
  /** One per body, in the same order. */
  windows: ReminderSendWindow[];
  schedule: LaunchSchedule;
  /** Recipients' saved zones, null when unset. */
  timeZones: readonly (string | null)[];
  mixes: ActionMix[];
  actions: LaunchAction[];
  users: UserDto[];
}) => {
  const [mixIndex, setMixIndex] = useState(0);
  const actionsById = new Map(actions.map(({ action }) => [action.id, action]));
  const mix = mixes.at(mixIndex) ?? mixes.at(0);
  const sampleId = mix?.userIds[0];
  const sample = users.find((user) => user.id === sampleId);

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
        <SelectableCardGroup label="Preview as">
          {mixes.map((option, index) => (
            <SelectableCard
              key={option.actionIds.join(",")}
              selected={mix === option}
              onSelect={() => setMixIndex(index)}
              title={`${withCount(option.userIds.length, "member")} · ${withCount(option.actionIds.length, "task")} · ${option.minutes} min`}
            >
              {option.actionIds.map((id) => (
                <span key={id} className="block text-zinc-600">
                  {actionsById.get(id)?.name}
                </span>
              ))}
            </SelectableCard>
          ))}
        </SelectableCardGroup>
      )}
      {mixes.length > 0 && reminders.length > 0 && (
        <p className="text-xs text-zinc-500">
          Open a reminder to see it as these members get it
        </p>
      )}
      <ul className="text-sm">
        {reminders.map(({ body, window }) => {
          const previews =
            mix && sample
              ? reminderVariants(body).map((variant) => ({
                  variant,
                  rendered: renderLaunchReminder({
                    body: variant.body,
                    window,
                    schedule,
                    member: sample,
                    memberActions: mix.actionIds.flatMap((id) => {
                      const action = actionsById.get(id);
                      return action ? [action] : [];
                    }),
                    suiteActionName: actions.at(0)?.action.name ?? "",
                    siteUrl: getSiteUrl(),
                    isFirstAssignedSuite: variant.isFirstAssignedSuite,
                  }),
                }))
              : [];
          return (
            <li key={window.name}>
              <Disclosure
                summaryClassName={cn(early.has(window) && "text-red-600")}
                summary={
                  <span className="flex flex-1 justify-between gap-4">
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
                  </span>
                }
              >
                {sample && previews.length > 0 ? (
                  previews.map(({ variant, rendered }) => (
                    <div
                      key={variant.label}
                      className="mb-3 ml-4 flex flex-col gap-3 border-l-2 border-zinc-200 pl-3"
                    >
                      <p className="text-xs text-zinc-500">
                        {body.cohortType === "group_leads_with_uncompleted"
                          ? `As ${sample.name} would get it leading a group with ${SAMPLE_GROUP_UNFINISHED} members still to finish`
                          : `As ${sample.name} gets it`}
                      </p>
                      {variant.label && (
                        <p className="text-xs font-medium text-zinc-700">
                          {variant.label}
                        </p>
                      )}
                      {(rendered.emailSubject || rendered.emailMessage) && (
                        <EmailMockup
                          subject={rendered.emailSubject}
                          body={rendered.emailMessage ?? ""}
                          recipient={sample.name}
                        />
                      )}
                      <div className="flex flex-wrap items-start gap-3">
                        {rendered.textMessage && (
                          <TextMockup message={rendered.textMessage} />
                        )}
                        {rendered.pushMessage && (
                          <PushMockup message={rendered.pushMessage} />
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="mb-2 ml-4 text-xs text-zinc-500">
                    The preview appears once members load.
                  </p>
                )}
              </Disclosure>
            </li>
          );
        })}
      </ul>
    </LaunchCheck>
  );
};

export default LaunchRemindersCheck;
