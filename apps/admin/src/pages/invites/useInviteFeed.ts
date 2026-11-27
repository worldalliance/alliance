import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useEventLogWebSocket } from "../../lib/useEventLogWebSocket";
import {
  InviteFeedKind,
  useInviteFeedAdmin,
} from "../../lib/useInviteFeedAdmin";
import { formatLocalDateTime } from "../../ui/DateTimePicker";

export const FEED_SETTINGS_KEY = "alliance-admin-invite-feed-settings";

const settingsSchema = z.object({
  numbered: z.boolean(),
  /** Wall-clock time in the viewer's zone, as a datetime-local value. */
  startAt: z
    .string()
    .refine((value) => !Number.isNaN(new Date(value).getTime())),
});
export type FeedSettings = z.infer<typeof settingsSchema>;

export const INVITE_KIND_LABEL: Record<InviteFeedKind, string> = {
  [InviteFeedKind.Individual]: "individual invite",
  [InviteFeedKind.Group]: "group invite",
};

function loadSettings(): FeedSettings {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const defaults = {
    numbered: true,
    startAt: formatLocalDateTime(startOfToday, "minute"),
  };
  try {
    const stored = window.localStorage.getItem(FEED_SETTINGS_KEY);
    return stored === null
      ? defaults
      : (settingsSchema.safeParse(JSON.parse(stored)).data ?? defaults);
  } catch {
    return defaults;
  }
}

/**
 * The live feed both views show: invites created since a start time, newest
 * first, refetched on each `invite-created` socket event and every 10 s.
 * Settings persist in this browser, so the full-screen view opens on the
 * tab's.
 */
export function useInviteFeed() {
  const [settings, setSettings] = useState(loadSettings);
  useEffect(() => {
    window.localStorage.setItem(FEED_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const feed = useInviteFeedAdmin(settings.startAt);
  const { isConnected, setOnInviteCreated } = useEventLogWebSocket();
  const { refetch } = feed;
  const refresh = useCallback(() => void refetch(), [refetch]);
  useEffect(() => {
    setOnInviteCreated(refresh);
    return () => setOnInviteCreated(null);
  }, [refresh, setOnInviteCreated]);

  const invites = useMemo(
    () =>
      [...(feed.data ?? [])].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime() ||
          right.id.localeCompare(left.id),
      ),
    [feed.data],
  );

  return {
    settings,
    /** An empty value is ignored, as the control can report one mid-edit. */
    setStartAt: (startAt: string) => {
      if (startAt) setSettings((current) => ({ ...current, startAt }));
    },
    setNumbered: (numbered: boolean) =>
      setSettings((current) => ({ ...current, numbered })),
    feed,
    invites,
    isConnected,
  };
}

export type InviteFeed = ReturnType<typeof useInviteFeed>;
