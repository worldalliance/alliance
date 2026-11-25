import type { ActionUpdateDto } from "@alliance/shared/client";
import { useHomeActionUpdates } from "@alliance/shared/lib/useActionUpdates";
import { cn } from "@alliance/shared/styles/util";
import type { ReactNode } from "react";
import { href, Link } from "react-router";
import { NOTIFICATIONS_PREVIEW_LIMIT } from "../lib/useNotificationActions";
import { WalkthroughAnchor } from "../onboarding/walkthrough/steps";

const NO_UPDATES: ActionUpdateDto[] = [];

/** The tasks page's project updates: heading, load states, and the cards `children` lays out. */
export default function HomeUpdatesSection({
  className,
  children,
}: {
  className?: string;
  children: (params: {
    updates: ActionUpdateDto[];
    isNew: (updateId: number) => boolean;
    markOpened: (updateId: number) => void;
  }) => ReactNode;
}) {
  const {
    query: { data, isLoading, isError },
    isNew,
    markOpened,
  } = useHomeActionUpdates(NOTIFICATIONS_PREVIEW_LIMIT);
  const updates = data ?? NO_UPDATES;

  return (
    <section
      aria-label="Project updates"
      className={cn("flex flex-col gap-4", className)}
      data-walkthrough={WalkthroughAnchor.ActionUpdates}
    >
      <div className="flex flex-row justify-between items-center px-1">
        <p className="text-base font-semibold text-zinc-500">Project updates</p>
        <Link
          to={href("/action-updates")}
          className="font-medium text-green hover:underline"
        >
          See all
        </Link>
      </div>

      {isLoading && <p className="text-xs text-zinc-400">Loading updates…</p>}
      {isError && !isLoading && (
        <p className="text-xs text-red-400">Could not load updates.</p>
      )}
      {!isLoading && !isError && updates.length === 0 && (
        <p className="text-xs text-zinc-400">No recent updates yet.</p>
      )}
      {updates.length > 0 && children({ updates, isNew, markOpened })}
    </section>
  );
}
