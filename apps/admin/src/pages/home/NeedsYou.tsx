import { ArrowRight, Check } from "lucide-react";
import { formatCount } from "../../lib/formatNumber";
import { CountId, placeById, PlaceId, tabHref } from "../../places";
import type { QueueCount } from "../../shell/useQueueCounts";
import Button, { ButtonVariant } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { Section } from "../../ui/templates/Overview";
import { useDelayedFlag } from "../../ui/templates/useDelayedFlag";
import { waitingQueues } from "./homeRules";

const QUEUE: Record<CountId, { label: string; open: string; to: string }> = {
  [CountId.NeedsReply]: {
    label: "Texts need a reply",
    open: "Open inbox",
    to: placeById(PlaceId.Inbox).path,
  },
  [CountId.WelcomeQueue]: {
    label: "New members to welcome",
    open: "Open welcome queue",
    to: placeById(PlaceId.WelcomeQueue).path,
  },
  [CountId.AwaitingGroup]: {
    label: "Members awaiting a group",
    open: "Open group assignment",
    to: tabHref(placeById(PlaceId.Groups), { tab: "awaiting" }),
  },
  [CountId.PartnershipResponses]: {
    label: "Partnership responses to review",
    open: "Open partnerships",
    to: placeById(PlaceId.OutreachPartnerships).path,
  },
};

const COUNT_FAILED = "· This count couldn't load.";

function Loading() {
  const show = useDelayedFlag(true);
  return (
    <div role="status" aria-label="Loading" className="h-6">
      {show && <Skeleton className="h-6 w-64" />}
    </div>
  );
}

/**
 * The queues with someone waiting, in their fixed order, each with its count
 * and the way to it. One line when none has.
 */
export function NeedsYou({ counts }: { counts: Record<CountId, QueueCount> }) {
  const queues = waitingQueues(counts);
  if (queues === null) return <Loading />;
  if (queues.length === 0) {
    return (
      <p className="flex h-6 items-center gap-2 text-fg-muted">
        <Check aria-hidden="true" className="size-4 text-success" />
        Nothing needs you right now
      </p>
    );
  }
  return (
    <Section title="Needs you">
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {queues.map(({ id, count }) => (
          <li key={id} className="flex items-center gap-4 px-card py-bar">
            <span className="w-14 shrink-0 text-heading font-semibold tabular-nums">
              {count === null ? "—" : formatCount(count)}
            </span>
            <span className="min-w-0 flex-1">
              {QUEUE[id].label}
              {count === null && (
                <span className="text-danger"> {COUNT_FAILED}</span>
              )}
            </span>
            <Button
              variant={ButtonVariant.Default}
              size="small"
              to={QUEUE[id].to}
            >
              {QUEUE[id].open}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
