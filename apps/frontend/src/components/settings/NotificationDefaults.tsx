import {
  CHANNEL_LABEL,
  CHANNELS,
  kindsIn,
  overrideCount,
  overrideCountNote,
  RECEIVES_NOTHING_WARNING,
  receivesNothing,
  SECTION_TITLE,
  SECTIONS,
  TEXT_NOTICE_COPY,
  textNotice,
} from "@alliance/shared/lib/notificationSettings";
import { useNotificationSettings } from "@alliance/shared/lib/useNotificationSettings";
import { ButtonColor } from "@alliance/sharedweb/ui/Button";
import YesNoToggle from "@alliance/sharedweb/ui/YesNoToggle";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { href, Link } from "react-router";
import NotificationSettingsPending from "./NotificationSettingsPending";
import SaveState from "./SaveState";

export default function NotificationDefaults() {
  const {
    settings,
    loadFailed,
    retrying,
    refetch,
    save,
    retry,
    statusOf,
    shownDefault,
  } = useNotificationSettings();

  if (!settings) {
    return (
      <NotificationSettingsPending
        loadFailed={loadFailed}
        retrying={retrying}
        onRetry={() => void refetch()}
      />
    );
  }

  const notice = textNotice(settings);

  return (
    <div className="flex flex-col gap-y-4">
      {receivesNothing(settings) && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>{RECEIVES_NOTHING_WARNING}</span>
        </div>
      )}
      <div>
        <h3 className="font-medium mb-1">Send me notifications by</h3>
        <div className="flex flex-col divide-y divide-zinc-200">
          {CHANNELS.map((channel) => {
            const target = { type: "default" as const, channel };
            const note = overrideCountNote(
              overrideCount(settings, channel),
              channel,
            );
            const value = shownDefault(settings, channel);
            return (
              <div key={channel} className="py-3">
                <div className="flex flex-row items-center justify-between gap-x-4">
                  <span className="font-medium">{CHANNEL_LABEL[channel]}</span>
                  <div className="flex items-center gap-x-3">
                    <SaveState
                      status={statusOf(target)}
                      onRetry={() => retry(target)}
                    />
                    <YesNoToggle
                      value={value}
                      onChange={(choice) =>
                        choice !== value &&
                        save([{ type: "default", channel, value: choice }])
                      }
                      ariaLabel={`${CHANNEL_LABEL[channel]} by default`}
                      yesLabel="On"
                      noLabel="Off"
                      yesColor={ButtonColor.Green}
                    />
                  </div>
                </div>
                {note && <p className="text-sm text-zinc-500 mt-1">{note}</p>}
                {channel === "text" && notice && (
                  <p className="text-sm text-amber-700 mt-1">
                    {TEXT_NOTICE_COPY[notice]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <nav aria-label="Notification types">
        <h3 className="font-medium mb-1">Choose for each notification</h3>
        <ul className="flex flex-col divide-y divide-zinc-200 border-y border-zinc-200">
          {SECTIONS.filter((section) => kindsIn(settings, section).length).map(
            (section) => (
              <li key={section}>
                <Link
                  to={href("/settings/notifications/:section", { section })}
                  className="flex items-center justify-between py-3 hover:bg-zinc-50"
                >
                  <span>{SECTION_TITLE[section]}</span>
                  <ChevronRight
                    size={18}
                    className="text-zinc-400"
                    aria-hidden
                  />
                </Link>
              </li>
            ),
          )}
        </ul>
      </nav>
    </div>
  );
}
