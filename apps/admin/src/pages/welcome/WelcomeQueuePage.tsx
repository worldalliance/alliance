import type { WelcomeQueueMemberDto } from "@alliance/shared/client/types.gen";
import { linkHints } from "@alliance/shared/lib/copy";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { getSiteUrl } from "../../lib/config";
import { formatDateTime } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import { useWelcomeQueueAdmin } from "../../lib/useWelcomeQueueAdmin";
import { PlaceId } from "../../places";
import NewTabMark from "../../ui/NewTabMark";
import { PersonCell, personName } from "../../ui/PersonCell";
import { linkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import {
  FilterBar,
  ListContent,
  listCount,
  ViewSwitch,
} from "../../ui/templates/List";
import { Page } from "../../ui/templates/Page";
import {
  ContentState,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";

enum Show {
  All = "all",
  StaffLiked = "staff-liked",
}

const SHOWS: Record<Show, (entry: WelcomeQueueMemberDto) => boolean> = {
  [Show.All]: () => true,
  [Show.StaffLiked]: (entry) => entry.staffLikeCount > 0,
};

const isShow = (value: string | null): value is Show =>
  Object.values<string | null>(Show).includes(value);

const NUMBER = "text-right";
const HEADS: readonly (readonly [string, string | undefined])[] = [
  ["Member", undefined],
  ["Member ID", undefined],
  ["Completed", undefined],
  ["Staff likes", NUMBER],
  ["Completion ID", undefined],
];

const commentsUrl = (entry: WelcomeQueueMemberDto) =>
  `${getSiteUrl()}/actions/${entry.actionId}/activity/${entry.activityId}#comments`;

/** `?show=staff-liked`, replacing history; the default stays out of the URL. */
function useShow(): [Show, (show: Show) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("show");
  const set = (show: Show) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (show === Show.All) next.delete("show");
        else next.set("show", show);
        return next;
      },
      { replace: true },
    );
  return [isShow(raw) ? raw : Show.All, set];
}

export default function WelcomeQueuePage() {
  const queue = useWelcomeQueueAdmin();
  const [show, setShow] = useShow();
  const all = queue.data?.members;
  const rows = useMemo(() => (all ?? []).filter(SHOWS[show]), [all, show]);
  const liked = all?.filter(SHOWS[Show.StaffLiked]).length;
  const unconfigured = queue.data?.requiredActionCount === 0;

  return (
    <Page
      fill
      place={PlaceId.WelcomeQueue}
      description="Members who have signed, finished every required onboarding task open to them, and have no staff comment on an onboarding completion. Greet them on their latest completion."
      banner={<RefreshFailedBanner things="the welcome queue" query={queue} />}
    >
      <FilterBar
        count={listCount({
          shown: rows.length,
          total: all?.length,
          noun: "member",
        })}
      >
        <ViewSwitch
          label="Show"
          items={[
            {
              id: Show.All,
              label: all ? `All (${formatCount(all.length)})` : "All",
            },
            {
              id: Show.StaffLiked,
              label:
                liked === undefined
                  ? "Staff liked"
                  : `Staff liked (${formatCount(liked)})`,
            },
          ]}
          value={show}
          onChange={setShow}
        />
      </FilterBar>
      <ListContent>
        <ContentState
          things="the welcome queue"
          query={queue}
          refreshBanner={false}
          skeleton={
            <TableSkeleton
              bleed
              columns={HEADS.length + 1}
              columnClassNames={HEADS.map(([, className]) => className)}
            />
          }
          empty={rows.length === 0}
          filtered={
            !unconfigured && show !== Show.All && (all?.length ?? 0) > 0
          }
          onClearFilters={() => setShow(Show.All)}
          emptyTitle={
            unconfigured
              ? "No required onboarding tasks are open"
              : "No one is waiting for a welcome"
          }
          emptyDescription={
            unconfigured
              ? "The queue lists members who finished every required onboarding task, so it stays empty until one is open to members."
              : undefined
          }
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                {HEADS.map(([label, className]) => (
                  <TableHead key={label} className={className}>
                    {label}
                  </TableHead>
                ))}
                <TableHead actions>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((entry) => (
                <TableRow key={entry.activityId}>
                  <PersonCell
                    firstColumn
                    userId={entry.user.id}
                    name={entry.user.displayName}
                    profilePicture={entry.user.profilePicture}
                  />
                  <TableCell className="font-mono text-xs text-fg-muted">
                    {entry.user.id}
                  </TableCell>
                  <TableCell>{formatDateTime(entry.completedAt)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCount(entry.staffLikeCount)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-fg-muted">
                    {entry.activityId}
                  </TableCell>
                  <TableCell actions>
                    <a
                      href={commentsUrl(entry)}
                      target="_blank"
                      rel="noreferrer"
                      className={linkClass}
                      aria-label={`Leave welcome comment: ${personName({ userId: entry.user.id, name: entry.user.displayName })}, ${linkHints.opensInNewTab}`}
                    >
                      Leave welcome comment
                      <NewTabMark />
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ContentState>
      </ListContent>
    </Page>
  );
}
