import { cn } from "@alliance/shared/styles/util";
import { useState } from "react";
import {
  ACTION_PRIORITIES,
  ACTION_PRIORITY_LABELS,
  ActionPriority,
  FEATURED_IMPACT_ACTIONS,
  type FeaturedImpactAction,
} from "../../../../content/featuredImpactActions";
import { RedesignPage } from "../links";
import {
  ACTIONS_BODY,
  ACTIONS_TITLE,
  HIDDEN_IMPACT_ACTIONS,
  impactStats,
  membersAtAction,
  PROGRESS_LEDE,
  PROGRESS_TITLE,
  STATS_BODY,
  STATS_TITLE,
} from "../pageContent";
import { ImpactCard } from "../sections/PageCards";
import {
  BandHeading,
  BandLede,
  PageBand,
  PageShell,
} from "../sections/PageShell";
import { PANEL_GREEN, type RedesignTheme } from "../theme";
import { RdTexturedPanel } from "../ui";

const shown = FEATURED_IMPACT_ACTIONS.filter(
  (action) => !HIDDEN_IMPACT_ACTIONS.includes(action.actionId),
);

function matchesPriorities(
  action: FeaturedImpactAction,
  selected: readonly ActionPriority[],
): boolean {
  return action.tags.some((tag) => selected.includes(tag));
}

function PriorityFilter({
  selected,
  onToggle,
}: {
  selected: readonly ActionPriority[];
  onToggle: (priority: ActionPriority) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filter by priority"
      className="flex flex-wrap gap-2"
    >
      {ACTION_PRIORITIES.map((priority) => {
        const pressed = selected.includes(priority);
        return (
          <button
            key={priority}
            type="button"
            aria-pressed={pressed}
            onClick={() => onToggle(priority)}
            className={cn(
              "border px-3 py-2 text-sm transition-colors",
              pressed
                ? "border-[var(--rd-primary)] bg-[var(--rd-primary)] text-white"
                : "border-[var(--rd-ink)]/15 text-[var(--rd-ink)]/70 hover:border-[var(--rd-ink)]/35",
            )}
            style={{ borderRadius: "var(--rd-radius-input)" }}
          >
            {ACTION_PRIORITY_LABELS[priority]}
          </button>
        );
      })}
    </div>
  );
}

/** The headline figures, each tied back to the action that produced it. */
function Statistics() {
  return (
    <PageBand>
      <RdTexturedPanel tint={PANEL_GREEN}>
        <div className="mb-8 flex flex-col gap-3">
          <h2 className="rd-headline text-[1.9rem] leading-tight text-white sm:text-[2.4rem]">
            {STATS_TITLE}
          </h2>
          <p className="max-w-[46rem] text-[1.08rem] leading-snug text-white/75 sm:text-[1.2rem]">
            {STATS_BODY}
          </p>
        </div>
        <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {impactStats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col gap-1 border-t border-white/20 pt-4"
            >
              <dt className="rd-headline text-[2.4rem] leading-none text-white">
                {stat.value}
              </dt>
              <dd className="text-[1rem] leading-snug text-white/75">
                {stat.label}
                <span className="mt-1.5 block text-[0.85rem] text-white/50">
                  {`${stat.members} members at the time`}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </RdTexturedPanel>
    </PageBand>
  );
}

function ActionColumn({
  actions,
}: {
  actions: readonly FeaturedImpactAction[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {actions.map((action) => (
        <ImpactCard
          key={action.actionId}
          action={action}
          members={membersAtAction[action.actionId]}
          className="border border-[var(--rd-ink)]/10"
        />
      ))}
    </div>
  );
}

/**
 * Photos hold the left column and the written outcomes the right, so the text
 * cards can hug their copy. Roughly three of them stand beside one photo.
 */
function Actions() {
  const [selected, setSelected] = useState<ActionPriority[]>([
    ...ACTION_PRIORITIES,
  ]);
  const matching = shown.filter((action) =>
    matchesPriorities(action, selected),
  );
  const withPhoto = matching.filter((action) => action.imageSrc);
  const textOnly = matching.filter((action) => !action.imageSrc);
  const twoColumns = withPhoto.length > 0 && textOnly.length > 0;

  function toggle(priority: ActionPriority) {
    setSelected((prev) =>
      prev.includes(priority)
        ? prev.filter((item) => item !== priority)
        : [...prev, priority],
    );
  }

  return (
    <PageBand className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <BandHeading>{ACTIONS_TITLE}</BandHeading>
        <BandLede>{ACTIONS_BODY}</BandLede>
        <PriorityFilter selected={selected} onToggle={toggle} />
      </div>
      {matching.length === 0 ? (
        <p className="text-[1rem] text-[var(--rd-ink)]/55">
          No matching actions.
        </p>
      ) : (
        <div
          className={cn(
            "grid items-start gap-3",
            twoColumns && "lg:grid-cols-2",
          )}
        >
          {withPhoto.length > 0 && <ActionColumn actions={withPhoto} />}
          {textOnly.length > 0 && <ActionColumn actions={textOnly} />}
        </div>
      )}
    </PageBand>
  );
}

export function RedesignProgressPage({ theme }: { theme: RedesignTheme }) {
  return (
    <PageShell
      theme={theme}
      page={RedesignPage.Progress}
      title={PROGRESS_TITLE}
      lede={PROGRESS_LEDE}
    >
      <Statistics />
      <Actions />
    </PageShell>
  );
}
