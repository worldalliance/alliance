import type { PreferenceSource } from "@alliance/shared/client/types.gen";
import {
  CHANNEL_LABEL,
  CHANNELS,
  defaultOf,
  SETTINGS_LOADING,
} from "@alliance/shared/lib/notificationSettings";
import { useId } from "react";
import { useNotificationSettingsAdmin } from "../../lib/useNotificationSettingsAdmin";
import { SectionRefreshError } from "./SectionQueryState";

const SOURCE_LABEL: Record<PreferenceSource, string> = {
  member: "Set by member",
  migrated: "Carried over by migration",
};

const onOff = (enabled: boolean) => (enabled ? "On" : "Off");

export default function UserNotificationSettingsSection({
  userId,
}: {
  userId: number;
}) {
  const {
    data: settings,
    isError,
    isRefetchError,
  } = useNotificationSettingsAdmin(userId);
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="border border-zinc-200 rounded p-3"
    >
      <h2 id={headingId} className="text-sm font-semibold text-zinc-700 mb-2">
        Notification settings
      </h2>
      {isRefetchError && <SectionRefreshError noun="notification settings" />}
      {settings ? (
        <div className="space-y-3 text-xs">
          <dl className="grid grid-cols-2 gap-1">
            {CHANNELS.map((channel) => {
              const enabled = defaultOf(settings, channel);
              return (
                <div key={channel} className="flex justify-between gap-2">
                  <dt className="text-zinc-500">
                    {CHANNEL_LABEL[channel]} default
                  </dt>
                  <dd className={enabled ? "text-green-600" : "text-zinc-400"}>
                    {onOff(enabled)}
                  </dd>
                </div>
              );
            })}
          </dl>
          <div className="pt-2 border-t border-zinc-100">
            <p className="font-medium text-zinc-500 mb-1">
              Overrides ({settings.overrides.length})
            </p>
            {settings.overrides.length ? (
              <ul className="space-y-1 max-h-64 overflow-y-auto">
                {settings.overrides.map((override) => (
                  <li
                    key={`${override.kind}:${override.channel}`}
                    className="flex items-baseline justify-between gap-2"
                  >
                    <span
                      className={
                        override.inEffect ? "text-zinc-800" : "text-zinc-400"
                      }
                    >
                      {override.label} · {CHANNEL_LABEL[override.channel]}
                    </span>
                    <span className="shrink-0 text-right">
                      <span
                        className={
                          override.enabled ? "text-green-600" : "text-zinc-400"
                        }
                      >
                        {onOff(override.enabled)}
                      </span>
                      <span className="block text-zinc-400">
                        {SOURCE_LABEL[override.source]}
                      </span>
                      {!override.inEffect && (
                        <span className="block text-zinc-400">
                          Not in effect
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-zinc-500">
                Every notification follows the defaults.
              </p>
            )}
          </div>
        </div>
      ) : isError ? (
        <p className="text-xs text-red-500">
          Failed to load notification settings.
        </p>
      ) : (
        <p className="text-xs text-zinc-500">{SETTINGS_LOADING}</p>
      )}
    </section>
  );
}
