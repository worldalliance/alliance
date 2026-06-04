import {
  ActionDto,
  ActionEventDto,
  ActionStatus,
  actionsFindOne,
} from "@alliance/shared/client";
import { formatNextTaskDue } from "@alliance/shared/lib/formatNextTaskDue";
import { getNextEvent } from "@alliance/shared/lib/largeActionCard";
import { deadlineColor } from "@alliance/shared/lib/taskTimeInfo";
import { cn } from "@alliance/shared/styles/util";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Coins, Flag, Users } from "lucide-react";
import React, { useState } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./HoverCard";

/**
 * Glyph used to mark an action link. A flag reads as "a cause to rally to",
 * which fits an Alliance action better than a generic link. Swap here to
 * restyle every action link platform-wide.
 */
const ActionIcon = Flag;

/**
 * Extract an action id from a link href. Handles both relative
 * (`/actions/92`, `/action/92`) and absolute (`https://worldalliance.org/actions/92`)
 * forms. Returns null when the href is not an action link.
 */
export function getActionIdFromHref(href: string | undefined): number | null {
  if (!href) return null;
  let pathname = href;
  if (!href.startsWith("/")) {
    try {
      pathname = new URL(href).pathname;
    } catch {
      return null;
    }
  }
  const match = pathname.match(/^\/actions?\/(\d+)(?:\/|$|\?|#)/);
  return match ? Number(match[1]) : null;
}

const STATUS_META: Record<
  ActionStatus,
  { label: string; className: string } | null
> = {
  draft: null,
  planned: { label: "Planned", className: "bg-blue-50 text-blue-700" },
  office_action: { label: "Underway", className: "bg-amber-50 text-amber-700" },
  member_action: { label: "Open now", className: "bg-green/10 text-green" },
  resolution: {
    label: "In resolution",
    className: "bg-amber-50 text-amber-700",
  },
  completed: { label: "Completed", className: "bg-green/10 text-green" },
  failed: { label: "Failed", className: "bg-red-50 text-red-600" },
  abandoned: { label: "Abandoned", className: "bg-zinc-100 text-zinc-500" },
};

type ActionLinkProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "ref"
> & {
  /** mdast node passed by react-markdown; discarded so it isn't spread to the DOM */
  node?: unknown;
};

/**
 * Renders a reference to an action as an inline link, visually distinguished
 * with a small icon, and shows a hover preview with enough context to
 * understand the action without navigating to it.
 *
 * Falls back to a plain link when the href is not an action link.
 */
export default function ActionLink({
  node: _node,
  href,
  children,
  className,
  ...rest
}: ActionLinkProps) {
  const actionId = getActionIdFromHref(href);
  const [open, setOpen] = useState(false);

  const { data, isError } = useQuery({
    queryKey: ["actionLinkPreview", actionId],
    queryFn: async () => {
      const res = await actionsFindOne({ path: { id: actionId! } });
      if (!res.data) {
        throw new Error("Failed to load action preview");
      }
      return res.data;
    },
    // Only fetch once the user actually hovers, so a page full of action
    // links doesn't fan out into a request per link on mount.
    enabled: open && actionId != null,
    staleTime: 5 * 60 * 1000,
  });

  if (actionId == null) {
    return (
      <a className={cn("text-link", className)} href={href} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      <HoverCardTrigger
        href={href}
        delay={250}
        closeDelay={100}
        className={cn(
          "text-link inline whitespace-normal underline-offset-2",
          className,
        )}
        {...rest}
      >
        {children}
        <ActionIcon
          className="inline-block shrink-0"
          size={13}
          style={{ margin: "-3px 0 0 3px" }}
          aria-hidden
        />
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        sideOffset={6}
        className="overflow-hidden p-0"
      >
        <ActionPreviewBody data={data} isError={isError} />
      </HoverCardContent>
    </HoverCard>
  );
}

function ActionPreviewBody({
  data,
  isError,
}: {
  data: ActionDto | undefined;
  isError: boolean;
}) {
  if (data) {
    return <ActionPreviewCard action={data} />;
  }
  if (isError) {
    return (
      <div className="w-72 p-3 text-sm text-zinc-500">
        Couldn&apos;t load this action.
      </div>
    );
  }
  // loading / not-yet-fetched skeleton
  return (
    <div className="w-72 animate-pulse p-3" aria-hidden>
      <div className="mb-2 h-3.5 w-3/4 rounded bg-zinc-200" />
      <div className="mb-1.5 h-2.5 w-full rounded bg-zinc-100" />
      <div className="h-2.5 w-5/6 rounded bg-zinc-100" />
    </div>
  );
}

function ActionPreviewCard({ action }: { action: ActionDto }) {
  const status = STATUS_META[action.status];
  const nextEvent = getNextEvent(action);
  const completed = action.userRelation === "completed";

  return (
    <div className="flex w-72 flex-col gap-y-1 p-3 text-left">
      <div className="flex items-start justify-between gap-x-2">
        <p className="line-clamp-2 text-sm font-semibold text-zinc-900">
          {action.name}
        </p>
        {status && (
          <span
            className={cn(
              "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
              status.className,
            )}
          >
            {status.label}
          </span>
        )}
      </div>
      {action.shortDescription && (
        <p className="line-clamp-3 text-xs leading-relaxed text-zinc-600">
          {action.shortDescription}
        </p>
      )}
      <ActionPreviewMeta action={action} nextEvent={nextEvent} />
      {completed && (
        <span className="mt-0.5 flex items-center gap-x-1 text-[11px] font-medium text-green">
          <CheckCircle2 size={12} className="shrink-0" />
          You&apos;ve completed this
        </span>
      )}
    </div>
  );
}

function ActionPreviewMeta({
  action,
  nextEvent,
}: {
  action: ActionDto;
  nextEvent: ActionEventDto | null;
}) {
  const items: React.ReactNode[] = [];

  if (action.usersCompleted > 0) {
    items.push(
      <span key="completed" className="flex items-center gap-x-1">
        <Users size={12} className="shrink-0" />
        {action.usersCompleted.toLocaleString()} completed
      </span>,
    );
  }

  if (action.type === "Funding" && action.donationAmount) {
    items.push(
      <span key="donation" className="flex items-center gap-x-1">
        <Coins size={12} className="shrink-0" />$
        {(action.donationAmount / 100).toFixed(0)} suggested
      </span>,
    );
  } else if (nextEvent) {
    items.push(
      <span
        key="deadline"
        className="flex items-center gap-x-1"
        style={{ color: deadlineColor(nextEvent, action) }}
      >
        <Clock size={12} className="shrink-0" />
        {formatNextTaskDue(new Date(nextEvent.date).getTime())}
      </span>,
    );
  } else if (action.timeEstimate) {
    items.push(
      <span key="time" className="flex items-center gap-x-1">
        <Clock size={12} className="shrink-0" />
        {action.timeEstimate} min
      </span>,
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-zinc-500">
      {items}
    </div>
  );
}
