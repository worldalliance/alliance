import { Settings2 } from "lucide-react";
import { formatDateTime } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import { InviteFeedKind } from "../../lib/useInviteFeedAdmin";
import {
  documentTitle,
  placeById,
  PlaceId,
  recordById,
  RecordId,
  tabHref,
} from "../../places";
import Button, { ButtonVariant, buttonVariants } from "../../ui/Button";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/Popover";
import { ContentState, RefreshFailedBanner } from "../../ui/templates/States";
import { ConnectionBadge, FeedSettingsFields, feedTime } from "./LiveFeedTab";
import { useInviteFeed } from "./useInviteFeed";

const SENTENCE: Record<InviteFeedKind, string> = {
  [InviteFeedKind.Individual]: "created an individual invite",
  [InviteFeedKind.Group]: "created a group invite",
};

/** The live feed for a shared screen, outside the admin's frame. */
export default function InviteFeedFullScreenPage() {
  const liveFeed = useInviteFeed();
  const { settings, feed, invites, isConnected } = liveFeed;

  return (
    <main className="min-h-full bg-canvas text-fg">
      <title>
        {documentTitle(recordById(RecordId.InviteFeedFullScreen).label)}
      </title>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-page py-5">
          <p className="text-heading font-semibold tracking-wide uppercase">
            The Alliance
          </p>
          <div className="flex items-center gap-3">
            <ConnectionBadge connected={isConnected} />
            <Popover>
              <PopoverTrigger
                className={buttonVariants({ variant: ButtonVariant.Default })}
              >
                <Settings2 aria-hidden="true" className="size-4" />
                Feed settings
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="flex w-80 flex-col gap-4 p-4"
              >
                <FeedSettingsFields feed={liveFeed} />
              </PopoverContent>
            </Popover>
            <Button
              variant={ButtonVariant.Ghost}
              to={tabHref(placeById(PlaceId.Invites), { tab: "feed" })}
            >
              Exit full screen
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-page pt-16 pb-20">
        <section className="flex flex-wrap items-end justify-between gap-8 border-b border-line pb-10">
          <h1 className="text-5xl font-semibold tracking-tight">Invite feed</h1>
          <p className="flex flex-col">
            <span className="text-5xl font-semibold tabular-nums">
              {feed.isSuccess ? formatCount(invites.length) : "—"}
            </span>
            <span className="text-fg-muted">
              invites since {formatDateTime(new Date(settings.startAt))}
            </span>
          </p>
        </section>

        <RefreshFailedBanner things="the invite feed" query={feed} inline />
        <section aria-live="polite">
          <ContentState
            things="the invite feed"
            query={feed}
            refreshBanner={false}
            skeleton={<div className="h-96" />}
            empty={invites.length === 0}
            emptyTitle="Waiting for the next invite"
            emptyDescription="New invites appear here as they're created."
          >
            <ol className="divide-y divide-line">
              {invites.map((invite, index) => (
                <li key={invite.id} className="flex items-baseline gap-6 py-5">
                  {settings.numbered && (
                    <span className="w-14 shrink-0 text-right text-2xl text-fg-muted tabular-nums">
                      {formatCount(invites.length - index)}
                    </span>
                  )}
                  <p className="min-w-0 flex-1 text-2xl">
                    <span className="font-semibold">
                      {invite.invitingUserDisplayName}
                    </span>{" "}
                    {SENTENCE[invite.kind]}
                  </p>
                  <time
                    dateTime={invite.createdAt}
                    className="shrink-0 text-fg-muted tabular-nums"
                  >
                    {feedTime(invite.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          </ContentState>
        </section>
      </div>
    </main>
  );
}
