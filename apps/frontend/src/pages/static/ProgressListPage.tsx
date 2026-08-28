import { href } from "react-router";
import BalancedColumns from "../../components/BalancedColumns";
import { FEATURED_IMPACT_ACTIONS } from "../../content/featuredImpactActions";
import { PROGRESS_PROJECTS } from "../../content/projects";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { ImpactCard, ProgressLinkCard } from "../../site/PageCards";
import {
  BandHeading,
  BandLede,
  PageBand,
  PageShell,
} from "../../site/PageShell";
import { PANEL_GREEN } from "../../site/tokens";
import { TexturedPanel } from "../../site/ui";

export function meta() {
  return socialPreviewMeta({
    title: "Progress — The Alliance",
    description:
      "Everything members have finished so far. Small actions, run to learn rather than to scale.",
    url: "/progress",
  });
}

const PROGRESS_TITLE = "Progress";
const PROGRESS_LEDE =
  "Everything members have finished so far. Small actions, run to learn rather than to scale.";

type ImpactStat = { value: string; label: string };

/** Each figure is the outcome of one closed action. */
const impactStats: ImpactStat[] = [
  { value: "11", label: "cafe locations adopted a bring-your-own-cup policy" },
  { value: "57 kg", label: "of e-waste collected and taken to be recycled" },
  { value: "$2,702", label: "raised for Helen Keller International" },
  { value: "100+", label: "California cities sent public records requests" },
  { value: "27", label: "researched comments submitted to regulators" },
  { value: "20", label: "potholes reported and filled" },
];

/** The headline figures, each tied back to the action that produced it. */
function Statistics() {
  return (
    <PageBand>
      <TexturedPanel tint={PANEL_GREEN}>
        <div className="mb-8 flex flex-col gap-3">
          <h2 className="site-display text-[1.9rem] leading-tight text-white sm:text-[2.4rem]">
            By the numbers
          </h2>
          <p className="max-w-[46rem] text-[1.08rem] leading-snug text-white/75 sm:text-[1.2rem]">
            What particular actions produced, at the scale we are working at
            now.
          </p>
        </div>
        <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {impactStats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col gap-1 border-t border-white/20 pt-4"
            >
              <dt className="site-display text-[2.4rem] leading-none text-white">
                {stat.value}
              </dt>
              <dd className="text-[1rem] leading-snug text-white/75">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>
      </TexturedPanel>
    </PageBand>
  );
}

function Projects() {
  return (
    <PageBand className="flex flex-col gap-8 pb-0 lg:pb-0">
      <div className="flex flex-col gap-3">
        <BandHeading>Projects</BandHeading>
        <BandLede>Series of actions that built on each other.</BandLede>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {PROGRESS_PROJECTS.map((project) => (
          <ProgressLinkCard
            key={project.slug}
            title={project.title}
            description={project.summary}
            to={href("/progress/projects/:slug", { slug: project.slug })}
            className="border border-[var(--site-ink)]/10"
          />
        ))}
      </div>
    </PageBand>
  );
}

/**
 * Two columns packed by height rather than by kind. The outcomes vary from a
 * photo card to two lines of text, so splitting them any other way leaves one
 * column running hundreds of pixels past the other.
 */
function Actions() {
  return (
    <PageBand className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <BandHeading>Actions</BandHeading>
        <BandLede>One-time actions that achieved tangible impact.</BandLede>
      </div>
      <BalancedColumns columns={{ default: 1, lg: 2 }} gap={12}>
        {FEATURED_IMPACT_ACTIONS.map((action) => (
          <ImpactCard
            key={action.actionId}
            action={action}
            className="border border-[var(--site-ink)]/10"
          />
        ))}
      </BalancedColumns>
    </PageBand>
  );
}

export default function ProgressListPage() {
  return (
    <PageShell title={PROGRESS_TITLE} lede={PROGRESS_LEDE}>
      <Statistics />
      <Projects />
      <Actions />
    </PageShell>
  );
}
