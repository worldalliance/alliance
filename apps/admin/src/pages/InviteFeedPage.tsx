import {
  shareUrlsFindInviteFeedAdmin,
  userGetOnetimeInvitesAdmin,
} from "@alliance/shared/client";
import type {
  OnetimeInviteDto,
  ReusableInviteFeedItemDto,
} from "@alliance/shared/client/types.gen";
import { useQuery } from "@tanstack/react-query";
import { Settings2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEventLogWebSocket } from "../lib/useEventLogWebSocket";

const INVITES_PER_PAGE = 200;
const STORAGE_KEY = "alliance-admin-invite-feed-settings";

type FeedSettings = {
  numbered: boolean;
  startAt: string;
};

enum InviteFeedKind {
  Alliance = "alliance",
  Group = "group",
  MultiUse = "multi-use",
  MultiUseGroup = "multi-use-group",
}

type InviteFeedItem = {
  id: string;
  createdAt: string;
  invitingUserDisplayName: string;
  kind: InviteFeedKind;
};

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join("T");
}

function defaultSettings(): FeedSettings {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return { numbered: true, startAt: toLocalInputValue(startOfToday) };
}

function loadSettings(): FeedSettings {
  const defaults = defaultSettings();
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return defaults;

  try {
    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "numbered" in parsed &&
      typeof parsed.numbered === "boolean" &&
      "startAt" in parsed &&
      typeof parsed.startAt === "string" &&
      !Number.isNaN(new Date(parsed.startAt).getTime())
    ) {
      return { numbered: parsed.numbered, startAt: parsed.startAt };
    }
  } catch {
    return defaults;
  }

  return defaults;
}

function isCreatedInvite(invite: OnetimeInviteDto): boolean {
  return invite.status === "link_unused" || invite.status === "link_used";
}

async function getOnetimeInvitesSince(
  startAt: string,
): Promise<InviteFeedItem[]> {
  const startTime = new Date(startAt).getTime();
  const invites: OnetimeInviteDto[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await userGetOnetimeInvitesAdmin({
      query: { page, limit: INVITES_PER_PAGE },
      throwOnError: true,
    });
    const batch = response.data.items;
    totalPages = response.data.totalPages;
    invites.push(
      ...batch.filter(
        (invite) =>
          isCreatedInvite(invite) &&
          new Date(invite.createdAt).getTime() >= startTime,
      ),
    );

    const oldestInvite = batch.at(-1);
    if (
      !oldestInvite ||
      new Date(oldestInvite.createdAt).getTime() < startTime
    ) {
      break;
    }
    page += 1;
  } while (page <= totalPages);

  return invites.map((invite) => ({
    id: `onetime-${invite.id}`,
    createdAt: invite.createdAt,
    invitingUserDisplayName: invite.invitingUser?.displayName ?? "Someone",
    kind: invite.community ? InviteFeedKind.Group : InviteFeedKind.Alliance,
  }));
}

function reusableInviteFeedItem(
  invite: ReusableInviteFeedItemDto,
): InviteFeedItem {
  return {
    id: `reusable-${invite.id}`,
    createdAt: invite.createdAt,
    invitingUserDisplayName: invite.invitingUserDisplayName,
    kind:
      invite.communityId === null
        ? InviteFeedKind.MultiUse
        : InviteFeedKind.MultiUseGroup,
  };
}

async function getInvitesSince(startAt: string): Promise<InviteFeedItem[]> {
  const [onetimeInvites, reusableInvitesResponse] = await Promise.all([
    getOnetimeInvitesSince(startAt),
    shareUrlsFindInviteFeedAdmin({
      query: { startAt: new Date(startAt).toISOString() },
      throwOnError: true,
    }),
  ]);
  return [
    ...onetimeInvites,
    ...reusableInvitesResponse.data.items.map(reusableInviteFeedItem),
  ];
}

const INVITE_TYPE_LABEL: Record<InviteFeedKind, string> = {
  [InviteFeedKind.Alliance]: "Alliance invite",
  [InviteFeedKind.Group]: "group invite",
  [InviteFeedKind.MultiUse]: "multi-use invite",
  [InviteFeedKind.MultiUseGroup]: "multi-use group invite",
};

function formatStartTime(startAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(startAt));
}

function formatInviteTime(createdAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

export default function InviteFeedPage() {
  const [settings, setSettings] = useState<FeedSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { isConnected, setOnInviteCreated } = useEventLogWebSocket();

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    if (settings) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  }, [settings]);

  const {
    data: invites = [],
    isError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["inviteFeed", settings?.startAt],
    queryFn: () => getInvitesSince(settings?.startAt ?? ""),
    enabled: settings !== null,
    refetchInterval: 10_000,
  });

  const refreshFeed = useCallback(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    setOnInviteCreated(refreshFeed);
    return () => setOnInviteCreated(null);
  }, [refreshFeed, setOnInviteCreated]);

  const sortedInvites = useMemo(
    () =>
      [...invites].sort((left, right) => {
        const dateDifference =
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime();
        return dateDifference || right.id.localeCompare(left.id);
      }),
    [invites],
  );

  if (!settings) {
    return <div className="min-h-screen bg-[#f7f7f3]" />;
  }

  return (
    <main className="min-h-screen bg-[#f7f7f3] text-[#14181d] [font-family:'Source_Sans_3',system-ui,sans-serif]">
      <header className="border-b border-[#081e40]/15 bg-[#f7f7f3]/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <p className="font-berlingske text-xl uppercase text-[#081e40]">
            The Alliance
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#52606d]">
              <span
                className={`h-2 w-2 rounded-full ${isConnected ? "bg-[#2f6f4e]" : "bg-[#a85b45]"}`}
              />
              {isConnected ? "Live" : "Reconnecting"}
            </div>
            <button
              type="button"
              aria-label="Feed settings"
              onClick={() => setSettingsOpen((open) => !open)}
              className="grid h-10 w-10 place-items-center rounded-md border border-[#081e40]/20 bg-white text-[#081e40] transition-colors hover:bg-[#e8ebe8]"
            >
              {settingsOpen ? <X size={18} /> : <Settings2 size={18} />}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 pb-20 pt-14 sm:px-8 sm:pt-20">
        <section className="grid gap-8 border-b border-[#081e40]/15 pb-12 md:grid-cols-[1fr_auto] md:items-end">
          <h1 className="text-5xl font-semibold leading-none tracking-tight text-[#081e40] sm:text-6xl">
            Invite Feed
          </h1>
          <div className="min-w-44 border-l-2 border-[#2f6f4e] pl-5 md:mb-1">
            <p className="text-4xl font-semibold tabular-nums text-[#081e40]">
              {sortedInvites.length}
            </p>
            <p className="mt-1 max-w-48 text-sm leading-snug text-[#52606d]">
              invites since {formatStartTime(settings.startAt)}
            </p>
          </div>
        </section>

        {settingsOpen && (
          <section className="mt-6 grid gap-5 rounded-lg border border-[#081e40]/15 bg-white p-5 shadow-[0_14px_40px_rgba(8,30,64,0.08)] sm:grid-cols-[1fr_auto] sm:items-end sm:p-6">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#081e40]">
                Count invites starting at, local time
              </span>
              <input
                type="datetime-local"
                value={settings.startAt}
                onChange={(event) => {
                  const startAt = event.target.value;
                  if (!startAt) return;
                  setSettings((current) =>
                    current ? { ...current, startAt } : current,
                  );
                }}
                className="w-full rounded-md border border-[#081e40]/20 bg-[#f7f7f3] px-3 py-2.5 text-sm text-[#14181d] outline-none focus:border-[#081e40]"
              />
            </label>
            <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border border-[#081e40]/15 px-4 py-2.5 text-sm font-semibold text-[#081e40]">
              <input
                type="checkbox"
                checked={settings.numbered}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? { ...current, numbered: event.target.checked }
                      : current,
                  )
                }
                className="h-4 w-4 accent-[#081e40]"
              />
              Number each invite
            </label>
          </section>
        )}

        <section aria-live="polite" className={settingsOpen ? "pt-6" : ""}>
          {isError ? (
            <div className="rounded-lg border border-[#a85b45]/30 bg-white px-5 py-8 text-center">
              <p>Could not load the invite feed.</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-3 text-sm font-semibold text-[#081e40] underline underline-offset-4"
              >
                Try again
              </button>
            </div>
          ) : isLoading ? (
            <p className="py-16 text-center text-[#52606d]">
              Loading invites...
            </p>
          ) : sortedInvites.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#081e40]/20 px-6 py-20 text-center">
              <p className="font-[Newsreader,Georgia,serif] text-3xl text-[#081e40]">
                Waiting for the next invitation.
              </p>
              <p className="mt-2 text-sm text-[#52606d]">
                New invites will appear here automatically.
              </p>
            </div>
          ) : (
            <ol className="divide-y divide-[#081e40]/12 border-b border-[#081e40]/15">
              {sortedInvites.map((invite, index) => (
                <li
                  key={invite.id}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-5 sm:gap-6 sm:py-6"
                >
                  {settings.numbered && (
                    <span className="w-10 font-[Newsreader,Georgia,serif] text-2xl tabular-nums text-[#2f6f4e] sm:w-14 sm:text-3xl">
                      {sortedInvites.length - index}
                    </span>
                  )}
                  <p
                    className={`font-[Newsreader,Georgia,serif] text-2xl leading-tight text-[#081e40] sm:text-3xl ${settings.numbered ? "" : "col-start-1"}`}
                  >
                    <span className="font-semibold">
                      {invite.invitingUserDisplayName}
                    </span>{" "}
                    created a{" "}
                    <em className="font-normal">
                      {INVITE_TYPE_LABEL[invite.kind]}
                    </em>
                  </p>
                  <time
                    dateTime={invite.createdAt}
                    className="text-sm tabular-nums text-[#52606d]"
                  >
                    {formatInviteTime(invite.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
