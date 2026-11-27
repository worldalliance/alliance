import { formatDateTime, formatTime } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import { InviteFeedKind } from "../../lib/useInviteFeedAdmin";
import Badge, { BadgeTone } from "../../ui/Badge";
import DateTimePicker, { timeZoneLabel } from "../../ui/DateTimePicker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { CheckboxField, Field } from "../../ui/templates/Form";
import {
  OverviewGrid,
  Panel,
  PanelControls,
  StatTile,
} from "../../ui/templates/Overview";
import { PageBody } from "../../ui/templates/Page";
import {
  ContentState,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { type InviteFeed, useInviteFeed } from "./useInviteFeed";

const NUMBER = "text-right tabular-nums";
const KIND: Record<InviteFeedKind, string> = {
  [InviteFeedKind.Individual]: "Individual",
  [InviteFeedKind.Group]: "Group",
};

/** The time alone for today's invites, with the date for older ones. */
export const feedTime = (createdAt: string, now = new Date()) =>
  new Date(createdAt).toDateString() === now.toDateString()
    ? formatTime(createdAt)
    : formatDateTime(createdAt, { now });

export function ConnectionBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <Badge tone={BadgeTone.Success}>Live</Badge>
  ) : (
    <Badge tone={BadgeTone.Warning}>Reconnecting</Badge>
  );
}

export function FeedSettingsFields({ feed }: { feed: InviteFeed }) {
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <>
      <Field label={`Count invites from (${timeZoneLabel(localZone)})`}>
        {(control) => (
          <DateTimePicker
            {...control}
            value={feed.settings.startAt}
            onChange={(change) => feed.setStartAt(change.localValue)}
          />
        )}
      </Field>
      <CheckboxField
        label="Number each invite"
        help="Counts down from the newest."
        checked={feed.settings.numbered}
        onChange={(event) => feed.setNumbered(event.target.checked)}
      />
    </>
  );
}

export function LiveFeedTab() {
  const liveFeed = useInviteFeed();
  const { settings, feed, invites, isConnected } = liveFeed;
  const since = formatDateTime(new Date(settings.startAt));

  return (
    <PageBody>
      <OverviewGrid>
        <StatTile
          className="col-span-12 @3xl:col-span-4"
          label={`Invites since ${since}`}
          value={feed.isSuccess ? formatCount(invites.length) : "—"}
          note={<ConnectionBadge connected={isConnected} />}
        />
        <Panel
          title="Feed settings"
          description="Kept in this browser, for this view and full screen."
          className="col-span-12 @3xl:col-span-8"
        >
          <PanelControls>
            <FeedSettingsFields feed={liveFeed} />
          </PanelControls>
        </Panel>
      </OverviewGrid>
      <Panel title="Invites" flush>
        <RefreshFailedBanner things="the invite feed" query={feed} inline />
        <div aria-live="polite">
          <ContentState
            things="the invite feed"
            query={feed}
            refreshBanner={false}
            skeleton={<TableSkeleton columns={settings.numbered ? 4 : 3} />}
            empty={invites.length === 0}
            emptyTitle="Waiting for the next invite"
            emptyDescription="New invites appear here as they're created."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  {settings.numbered && (
                    <TableHead className="text-right">No.</TableHead>
                  )}
                  <TableHead>Member</TableHead>
                  <TableHead>Invite</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite, index) => (
                  <TableRow key={invite.id}>
                    {settings.numbered && (
                      <TableCell className={NUMBER}>
                        {formatCount(invites.length - index)}
                      </TableCell>
                    )}
                    <TableCell className="font-medium">
                      {invite.invitingUserDisplayName}
                    </TableCell>
                    <TableCell>{KIND[invite.kind]}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <time dateTime={invite.createdAt}>
                        {feedTime(invite.createdAt)}
                      </time>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ContentState>
        </div>
      </Panel>
    </PageBody>
  );
}
