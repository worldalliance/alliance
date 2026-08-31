import { cn } from "@alliance/shared/styles/util";
import { useState } from "react";
import { href } from "react-router";
import BalancedColumns from "../../components/BalancedColumns";
import {
  ACTION_PRIORITIES,
  ACTION_PRIORITY_LABELS,
  ActionPriority,
  FEATURED_IMPACT_ACTIONS,
  type FeaturedImpactAction,
} from "../../content/featuredImpactActions";
import {
  PROGRESS_PROJECTS,
  type ProgressProject,
} from "../../content/projects";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { ImpactCard, ProgressLinkCard } from "../../site/PageCards";
import { PageBand, PageShell } from "../../site/PageShell";

export function meta() {
  return socialPreviewMeta({
    title: "Progress — The Alliance",
    description: "Examples of projects that members have completed so far.",
    url: "/progress",
  });
}

const PROGRESS_TITLE = "Progress";
const PROGRESS_LEDE =
  "Examples of projects that members have completed so far.";

// type ImpactStat = { value: string; label: string };

// /** Each figure is the outcome of one closed action. */
// const impactStats: ImpactStat[] = [
//   { value: "11", label: "cafe locations adopted a bring-your-own-cup policy" },
//   { value: "57 kg", label: "of e-waste collected and taken to be recycled" },
//   { value: "$2,702", label: "raised for Helen Keller International" },
//   { value: "100+", label: "California cities sent public records requests" },
//   { value: "27", label: "researched comments submitted to regulators" },
//   { value: "20", label: "potholes reported and filled" },
// ];

enum ProgressItemKind {
  Writeup = "writeup",
  Action = "action",
}

type ProgressItem =
  | { kind: ProgressItemKind.Writeup; project: ProgressProject }
  | { kind: ProgressItemKind.Action; action: FeaturedImpactAction };

const ALL_PROJECTS: readonly ProgressItem[] = [
  ...PROGRESS_PROJECTS.map((project) => ({
    kind: ProgressItemKind.Writeup as const,
    project,
  })),
  ...FEATURED_IMPACT_ACTIONS.map((action) => ({
    kind: ProgressItemKind.Action as const,
    action,
  })),
];

function itemTags(item: ProgressItem) {
  switch (item.kind) {
    case ProgressItemKind.Writeup:
      return item.project.tags;
    case ProgressItemKind.Action:
      return item.action.tags;
    default:
      throw new Error(`unknown kind: ${item satisfies never}`);
  }
}

function itemKey(item: ProgressItem) {
  switch (item.kind) {
    case ProgressItemKind.Writeup:
      return item.project.slug;
    case ProgressItemKind.Action:
      return String(item.action.actionId);
    default:
      throw new Error(`unknown kind: ${item satisfies never}`);
  }
}

function matchesPriorities(
  item: ProgressItem,
  selected: readonly ActionPriority[],
): boolean {
  return itemTags(item).some((tag) => selected.includes(tag));
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
              "border px-3 py-2 text-sm transition-colors font-medium",
              pressed
                ? "border-(--site-primary) bg-(--site-primary) text-white"
                : "border-(--site-ink)/15 text-(--site-ink)/70 hover:border-(--site-ink)/35",
            )}
            style={{ borderRadius: "var(--site-radius-input)" }}
          >
            {ACTION_PRIORITY_LABELS[priority]}
          </button>
        );
      })}
    </div>
  );
}

function ProgressCard({ item }: { item: ProgressItem }) {
  const className = "bg-zinc-50";
  switch (item.kind) {
    case ProgressItemKind.Writeup:
      return (
        <ProgressLinkCard
          title={item.project.title}
          description={item.project.summary}
          tags={item.project.tags}
          to={href("/projects/:slug", { slug: item.project.slug })}
          className={className}
        />
      );
    case ProgressItemKind.Action:
      return <ImpactCard action={item.action} className={className} />;
    default:
      throw new Error(`unknown kind: ${item satisfies never}`);
  }
}

// /** The headline figures, each tied back to the action that produced it. */
// function Statistics() {
//   return (
//     <PageBand>
//       <TexturedPanel tint="var(--site-panel)">
//         <div className="mb-8 flex flex-col gap-3">
//           <h2 className="site-display text-[1.9rem] leading-tight text-white sm:text-[2.4rem]">
//             By the numbers
//           </h2>
//           <p className="max-w-[46rem] text-[1.08rem] leading-snug text-white/75 sm:text-[1.2rem]">
//             What particular actions produced, at the scale we are working at
//             now.
//           </p>
//         </div>
//         <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
//           {impactStats.map((stat) => (
//             <div
//               key={stat.label}
//               className="flex flex-col gap-1 border-t border-white/20 pt-4"
//             >
//               <dt className="site-display text-[2.4rem] leading-none text-white">
//                 {stat.value}
//               </dt>
//               <dd className="text-[1rem] leading-snug text-white/75">
//                 {stat.label}
//               </dd>
//             </div>
//           ))}
//         </dl>
//       </TexturedPanel>
//     </PageBand>
//   );
// }

/**
 * Two columns packed by height rather than by kind. The outcomes vary from a
 * photo card to two lines of text, so splitting them any other way leaves one
 * column running hundreds of pixels past the other.
 */
function Projects() {
  const [selected, setSelected] = useState<ActionPriority[]>([
    ...ACTION_PRIORITIES,
  ]);
  const shown = ALL_PROJECTS.filter((item) =>
    matchesPriorities(item, selected),
  );

  function toggle(priority: ActionPriority) {
    setSelected((prev) =>
      prev.includes(priority)
        ? prev.filter((item) => item !== priority)
        : [...prev, priority],
    );
  }

  return (
    <PageBand className="flex flex-col gap-8">
      <PriorityFilter selected={selected} onToggle={toggle} />
      {shown.length === 0 ? (
        <p className="text-base text-(--site-ink)/90">No matching projects.</p>
      ) : (
        <BalancedColumns columns={{ default: 1, lg: 2 }} gap={12}>
          {shown.map((item) => (
            <ProgressCard key={itemKey(item)} item={item} />
          ))}
        </BalancedColumns>
      )}
    </PageBand>
  );
}

export default function ProgressListPage() {
  return (
    <PageShell title={PROGRESS_TITLE} subtitle={PROGRESS_LEDE}>
      {/* <Statistics /> */}
      <Projects />
    </PageShell>
  );
}
