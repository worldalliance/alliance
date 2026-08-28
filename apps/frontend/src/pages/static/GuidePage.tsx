import { cn } from "@alliance/shared/styles/util";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { FEATURED_IMPACT_ACTIONS } from "../../content/featuredImpactActions";
import {
  alliancePriorities,
  type AlliancePriority,
} from "../../lib/alliancePriorities";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { priorities } from "../../site/content";
import {
  ACTION_CATEGORIES,
  GUIDE_CONTRACT_CAPTION,
  GUIDE_SECTION_ORDER,
  GUIDE_SECTIONS,
  GuideSectionKind,
} from "../../site/docContent";
import { DocProse } from "../../site/DocProse";
import {
  CommitCard,
  TaskCard,
  UpdateCard,
} from "../../site/graphics/ProductCards";
import { useActiveSection } from "../../site/hooks";
import { FAQ_HREF, FOUNDATION_HREF, GOVERNANCE_HREF } from "../../site/links";
import { NAV_HEIGHT } from "../../site/Navbar";
import { ContractCard, ImpactCard } from "../../site/PageCards";
import { PageShell } from "../../site/PageShell";
import { PRIORITY_TINTS } from "../../site/tokens";
import { SITE_COL, SiteArrow } from "../../site/ui";

export function meta() {
  return socialPreviewMeta({
    title: "Guide to the Alliance",
    description:
      "What we are trying to do, how the office and members divide the work, and where we go next.",
    url: "/guide",
  });
}

const GUIDE_TITLE = "Guide to the Alliance";
const GUIDE_LEDE =
  "What we are trying to do, how the office and members divide the work, and where we go next.";
/** Names the table of contents for screen readers; nothing draws it. */
const GUIDE_TOC_LABEL = "Sections";

/** The three resources the guide hands off to at the end. */
const RESOURCE_LINKS = [
  {
    to: FOUNDATION_HREF,
    label: "Our foundation",
    description: "describes how we derived our priorities",
  },
  {
    to: GOVERNANCE_HREF,
    label: "Our governance",
    description: "describes office and member obligations",
  },
  {
    to: FAQ_HREF,
    label: "Our FAQ",
    description: "answers common questions",
  },
];

function PriorityGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {priorities.map((priority, index) => (
        <article
          key={priority.id}
          className="relative isolate flex min-h-[190px] flex-col justify-end overflow-hidden p-5 text-white"
          style={{
            borderRadius: "var(--site-radius-card)",
            backgroundColor: PRIORITY_TINTS[index % PRIORITY_TINTS.length],
          }}
        >
          <img
            src={priority.image}
            alt=""
            aria-hidden
            className="absolute inset-0 -z-10 size-full object-cover"
            style={{
              mixBlendMode: "screen",
              filter: "grayscale(1) contrast(1.05)",
              opacity: 0.45,
            }}
          />
          <h3 className="text-[1.4rem] leading-tight">
            {priority.title.replace("\n", " ")}
          </h3>
          <p className="mt-2 text-[0.9rem] leading-snug text-white/85">
            {priority.description}
          </p>
        </article>
      ))}
    </div>
  );
}

/** The sourced write-up of each crisis, which the grid above only summarises. */
function PriorityDetail() {
  return (
    <div className="flex flex-col gap-8">
      {alliancePriorities.map((priority: AlliancePriority) => (
        <div key={priority.id} id={priority.id} className="flex flex-col gap-3">
          <h3 className="text-[1.2rem] leading-tight font-medium">
            {priority.title}
          </h3>
          <p className="text-[1.05rem] leading-[1.65] text-[var(--site-ink)]/85 sm:text-[1.12rem] [&_a]:text-[var(--site-primary)] [&_a]:underline [&_a]:decoration-[var(--site-primary)]/35 [&_a]:underline-offset-2">
            {priority.description}
          </p>
        </div>
      ))}
    </div>
  );
}

function CategoryTable() {
  return (
    <div
      className="overflow-hidden border border-[var(--site-ink)]/12"
      style={{ borderRadius: "var(--site-radius-card)" }}
    >
      {ACTION_CATEGORIES.map((category, index) => (
        <div
          key={category.name}
          className={cn(
            "grid gap-2 p-5 sm:grid-cols-[minmax(0,0.4fr)_minmax(0,1fr)] sm:gap-6",
            index > 0 && "border-t border-[var(--site-ink)]/12",
            index % 2 === 1 && "bg-[var(--site-surface-alt)]/60",
          )}
        >
          <p className="text-[1.02rem] font-medium text-[var(--site-primary)]">
            {category.name}
          </p>
          <ul className="flex list-outside list-disc flex-col gap-1.5 pl-5 text-[1rem] leading-snug text-[var(--site-ink)]/75">
            {category.examples.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ResourceLinks() {
  return (
    <div className="flex flex-col">
      {RESOURCE_LINKS.map((resource) => (
        <Link
          key={resource.to}
          to={resource.to}
          className="group flex items-center gap-3 border-t border-[var(--site-ink)]/12 py-5 last:border-b"
        >
          <span className="text-[1.08rem]">
            <span className="font-medium text-[var(--site-primary)] group-hover:underline">
              {resource.label}
            </span>
            <span className="text-[var(--site-ink)]/70">
              {` ${resource.description}`}
            </span>
          </span>
          <SiteArrow className="size-2.5 text-[var(--site-primary)] transition-transform duration-300 ease-out group-hover:translate-x-1 group-hover:-translate-y-1" />
        </Link>
      ))}
    </div>
  );
}

/** Whatever sits between a section's prose and the prose that follows it. */
const guideExtras: Record<GuideSectionKind, ReactNode> = {
  [GuideSectionKind.Introduction]: null,
  [GuideSectionKind.Structure]: (
    <div className="flex flex-col gap-6">
      <ContractCard caption={GUIDE_CONTRACT_CAPTION} />
      <div className="max-w-[24rem]">
        <CommitCard />
      </div>
    </div>
  ),
  [GuideSectionKind.Actions]: (
    <div className="flex flex-col gap-6">
      {/* The two screens a member sees: the action, then what came of it. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <TaskCard />
        <UpdateCard />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {FEATURED_IMPACT_ACTIONS.slice(0, 3).map((action) => (
          <ImpactCard
            key={action.actionId}
            action={action}
            className="border border-[var(--site-ink)]/10"
          />
        ))}
      </div>
    </div>
  ),
  [GuideSectionKind.Priorities]: (
    <div className="flex flex-col gap-10">
      <PriorityGrid />
      <PriorityDetail />
    </div>
  ),
  [GuideSectionKind.Roadmap]: <CategoryTable />,
  [GuideSectionKind.Resources]: <ResourceLinks />,
};

export default function GuidePage() {
  const active = useActiveSection(GUIDE_SECTION_ORDER);

  return (
    <PageShell title={GUIDE_TITLE} lede={GUIDE_LEDE}>
      <div className={cn(SITE_COL, "pt-16 pb-20 lg:pt-20 lg:pb-28")}>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:gap-16">
          <nav
            className="hidden self-start lg:block"
            style={{ position: "sticky", top: NAV_HEIGHT + 32 }}
            aria-label={GUIDE_TOC_LABEL}
          >
            <ul className="flex flex-col gap-2.5">
              {GUIDE_SECTION_ORDER.map((kind) => (
                <li key={kind}>
                  <a
                    href={`#${kind}`}
                    aria-current={kind === active ? "true" : undefined}
                    className={cn(
                      "text-[1rem] transition-colors",
                      kind === active
                        ? "font-semibold text-[var(--site-primary)]"
                        : "text-[var(--site-ink)]/60 hover:text-[var(--site-primary)]",
                    )}
                  >
                    {GUIDE_SECTIONS[kind].label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex max-w-[46rem] flex-col gap-16">
            {GUIDE_SECTION_ORDER.map((kind) => {
              const section = GUIDE_SECTIONS[kind];
              return (
                <section
                  key={kind}
                  id={kind}
                  className="flex scroll-mt-32 flex-col gap-6"
                >
                  <h2 className="site-display text-[1.9rem] leading-tight text-[var(--site-primary)] sm:text-[2.2rem]">
                    {section.label}
                  </h2>
                  {section.markdown.trim() && (
                    <DocProse markdown={section.markdown} />
                  )}
                  {guideExtras[kind]}
                  {section.markdownAfter && (
                    <DocProse markdown={section.markdownAfter} />
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
