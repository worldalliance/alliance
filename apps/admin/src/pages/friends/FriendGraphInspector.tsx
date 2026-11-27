import type { ReactNode } from "react";
import { Link } from "react-router";
import type { useUserGraphFilters } from "../../components/force-graph/UserGraphFilters";
import { UserGraphFilterControls } from "../../components/force-graph/UserGraphFilters";
import { countOf, formatCount } from "../../lib/formatNumber";
import { memberHref } from "../../lib/hrefs";
import Button, { ButtonVariant } from "../../ui/Button";
import { linkClass, nameLinkClass } from "../../ui/styles";
import { Field } from "../../ui/templates/Form";
import type { GraphNode } from "./friendGraph";

export const SPREAD = { min: 20, max: 800, step: 10, initial: 120 } as const;

function InspectorSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-4 border-b border-line p-card"
    >
      <div className="flex min-h-control-sm items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function FriendGraphInspector({
  filters,
  matching,
  total,
  spread,
  onSpreadChange,
  selected,
  friends,
}: {
  filters: ReturnType<typeof useUserGraphFilters>;
  /** Members passing the filters, or null while no filter is set. */
  matching: number | null;
  total: number;
  spread: number;
  onSpreadChange: (spread: number) => void;
  selected: GraphNode | null;
  /** The selected member's friends on the graph, by name. */
  friends: readonly GraphNode[];
}) {
  return (
    <>
      <InspectorSection
        title="Filters"
        action={
          <Button
            size="small"
            variant={ButtonVariant.Ghost}
            disabled={!filters.isActive}
            onClick={filters.clear}
          >
            Reset filters
          </Button>
        }
      >
        <UserGraphFilterControls filters={filters} />
        <p className="min-h-5 text-fg-muted tabular-nums" aria-live="polite">
          {matching === null
            ? "Members who don't match fade out."
            : `${formatCount(matching)} of ${countOf(total, "member")} match`}
        </p>
      </InspectorSection>
      <InspectorSection title="Layout">
        <Field label="Spread" help="How hard members push each other apart.">
          {(control) => (
            <input
              {...control}
              type="range"
              min={SPREAD.min}
              max={SPREAD.max}
              step={SPREAD.step}
              value={spread}
              onChange={(event) => onSpreadChange(Number(event.target.value))}
              className="w-full accent-accent"
            />
          )}
        </Field>
      </InspectorSection>
      <InspectorSection title="Selected member">
        {selected ? (
          <div className="flex flex-col gap-3">
            <p>
              <Link to={memberHref(selected.userId)} className={nameLinkClass}>
                {selected.displayName}
              </Link>
              <span className="text-fg-muted">
                {" "}
                · {countOf(friends.length, "friend")} on the graph
              </span>
            </p>
            {friends.length > 0 && (
              <ul aria-label={`Friends of ${selected.displayName}`}>
                {friends.map((friend) => (
                  <li key={friend.id} className="truncate py-0.5">
                    <Link to={memberHref(friend.userId)} className={linkClass}>
                      {friend.displayName}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-fg-muted">
            Click a member in the graph to highlight their friends and list them
            here.
          </p>
        )}
      </InspectorSection>
    </>
  );
}
