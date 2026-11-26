import { eventInEffectAt } from "@alliance/common/actionEvent";
import type { ActionEventDto } from "@alliance/shared/client";
import { sortByDateDescending } from "@alliance/shared/lib/actionEventsPanel";
import type { Ref } from "react";
import { formatDateTime } from "../../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import Badge, { BadgeTone } from "../../../ui/Badge";
import { cn } from "../../../ui/cn";
import PhaseBadge from "../../../ui/PhaseBadge";
import { Panel } from "../../../ui/templates/Overview";

/** A task's events, at least one, newest first, the one in effect marked "Now". */
export function TaskEventsPanel({
  events,
  now,
  listRef,
}: {
  events: ActionEventDto[];
  now: Date;
  /** Takes focus when the panel above it goes. */
  listRef?: Ref<HTMLOListElement>;
}) {
  const current = eventInEffectAt(events, now).event?.id;
  return (
    <Panel title="Events" description="Newest first" flush>
      <ol
        ref={listRef}
        tabIndex={-1}
        aria-label="Events"
        className="flex flex-col divide-y divide-line outline-none"
      >
        {sortByDateDescending(events).map((event) => (
          <li
            key={event.id}
            aria-current={event.id === current || undefined}
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 px-card py-2.5",
              event.id === current ? "border-l-accent" : "border-l-transparent",
            )}
          >
            <span
              className="min-w-0 flex-1 truncate font-medium"
              title={event.title}
            >
              {event.title}
            </span>
            {event.id === current && <Badge tone={BadgeTone.Accent}>Now</Badge>}
            <PhaseBadge status={event.newStatus} />
            <span className="text-caption text-fg-muted tabular-nums">
              {formatDateTime(event.date, {
                weekday: true,
                timeZone: LAUNCH_TIME_ZONE,
              })}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
