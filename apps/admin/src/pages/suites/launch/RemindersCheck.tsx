import type { CreateReminderGroupDto, UserDto } from "@alliance/shared/client";
import { useState } from "react";
import Disclosure from "../../../components/Disclosure";
import {
  SelectableCard,
  SelectableCardGroup,
} from "../../../components/SelectableCards";
import { LaunchSection } from "../../../components/suite-launch/launchBlockers";
import {
  nightRecipientCount,
  remindersBeforeLaunch,
  reminderVariants,
  renderLaunchReminder,
  SAMPLE_GROUP_UNFINISHED,
  type ReminderSendWindow,
} from "../../../components/suite-launch/launchReminders";
import type { LaunchSchedule } from "../../../components/suite-launch/launchSchedule";
import type { ActionMix } from "../../../components/suite-launch/memberLoad";
import type { LaunchAction } from "../../../components/suite-launch/useSuiteLaunchData";
import { getSiteUrl } from "../../../lib/config";
import { formatDateTime } from "../../../lib/formatDate";
import { countOf } from "../../../lib/formatNumber";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import { cn } from "../../../ui/cn";
import { LaunchCheck } from "./LaunchCheck";
import { EmailMockup, PushMockup, TextMockup } from "./MessageMockups";

const inPacific = (date: Date) =>
  formatDateTime(date, { weekday: true, timeZone: LAUNCH_TIME_ZONE });

const sendWindow = ({ start, end }: ReminderSendWindow) =>
  start.getTime() === end.getTime()
    ? inPacific(start)
    : `${inPacific(start)} – ${inPacific(end)}`;

/** The default reminders the launch creates, each as a sample member gets it. */
export function RemindersCheck({
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
}) {
  const [mixIndex, setMixIndex] = useState(0);
  const actionsById = new Map(actions.map(({ action }) => [action.id, action]));
  const mix = mixes.at(mixIndex) ?? mixes.at(0);
  const sample = users.find((user) => user.id === mix?.userIds[0]);
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
      title="Default reminders"
      passed={early.size === 0}
      summary={`${windows.length} created on launch${atNight > 0 ? ` · ${atNight} reach some members at night` : ""}`}
    >
      <div className="flex flex-col gap-4">
        <p className="text-fg-muted">
          Created on the members taking action event. Change them on the suite's
          Reminders tab after launch.
        </p>
        {mixes.length > 0 && (
          <SelectableCardGroup label="Preview as">
            {mixes.map((option, index) => (
              <SelectableCard
                key={option.actionIds.join(",")}
                selected={mix === option}
                onSelect={() => setMixIndex(index)}
                title={`${countOf(option.userIds.length, "member")} · ${countOf(option.actionIds.length, "task")} · ${option.minutes} min`}
              >
                {option.actionIds.map((id) => (
                  <span key={id} className="block">
                    {actionsById.get(id)?.name}
                  </span>
                ))}
              </SelectableCard>
            ))}
          </SelectableCardGroup>
        )}
        <ul className="-mx-1.5 flex flex-col">
          {reminders.map(({ body, window }) => {
            const night = nightCounts.get(window);
            return (
              <li key={window.name}>
                <Disclosure
                  summary={
                    <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4">
                      <span
                        className={cn(
                          "font-medium",
                          early.has(window) && "text-danger",
                        )}
                      >
                        {window.name}
                        {early.has(window) && " (sends before members start)"}
                      </span>
                      <span className="text-caption text-fg-muted">
                        {sendWindow(window)}
                      </span>
                      {!!night && (
                        <span className="basis-full text-caption text-warning">
                          Reaches {countOf(night, "member")} between 10pm and
                          8am their time
                        </span>
                      )}
                    </span>
                  }
                >
                  <ReminderPreview
                    body={body}
                    window={window}
                    schedule={schedule}
                    sample={sample}
                    memberActions={(mix?.actionIds ?? []).flatMap((id) => {
                      const action = actionsById.get(id);
                      return action ? [action] : [];
                    })}
                    suiteActionName={actions.at(0)?.action.name ?? ""}
                  />
                </Disclosure>
              </li>
            );
          })}
        </ul>
      </div>
    </LaunchCheck>
  );
}

function ReminderPreview({
  body,
  window,
  schedule,
  sample,
  memberActions,
  suiteActionName,
}: {
  body: CreateReminderGroupDto;
  window: ReminderSendWindow;
  schedule: LaunchSchedule;
  sample: UserDto | undefined;
  memberActions: LaunchAction["action"][];
  suiteActionName: string;
}) {
  if (!sample) {
    return (
      <p className="my-2 ml-7 text-caption text-fg-muted">
        The preview appears once members load.
      </p>
    );
  }
  return reminderVariants(body).map((variant) => {
    const rendered = renderLaunchReminder({
      body: variant.body,
      window,
      schedule,
      member: sample,
      memberActions,
      suiteActionName,
      siteUrl: getSiteUrl(),
      isFirstAssignedSuite: variant.isFirstAssignedSuite,
    });
    return (
      <div
        key={variant.label}
        className="my-3 ml-7 flex flex-col gap-3 border-l-2 border-line pl-4"
      >
        <p className="text-caption text-fg-muted">
          {body.cohortType === "group_leads_with_uncompleted"
            ? `As ${sample.name} would get it leading a group with ${SAMPLE_GROUP_UNFINISHED} members still to finish`
            : `As ${sample.name} gets it`}
        </p>
        {variant.label && (
          <p className="text-caption font-medium">{variant.label}</p>
        )}
        {(rendered.emailSubject || rendered.emailMessage) && (
          <EmailMockup
            subject={rendered.emailSubject}
            body={rendered.emailMessage ?? ""}
            recipient={sample.name}
          />
        )}
        <div className="flex flex-wrap gap-3">
          {rendered.textMessage && (
            <TextMockup message={rendered.textMessage} />
          )}
          {rendered.pushMessage && (
            <PushMockup message={rendered.pushMessage} />
          )}
        </div>
      </div>
    );
  });
}
