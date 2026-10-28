import { cn } from "@alliance/shared/styles/util";
import { SiteArrow } from "@alliance/sharedweb/ui/SiteArrow";
import type { ReactNode } from "react";
import { Link } from "react-router";
import janosPasztor from "../../assets/redesign/avatar-janos-pasztor.jpg";
import { FEATURED_IMPACT_ACTIONS } from "../../content/featuredImpactActions";
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
import { FontSwitcher } from "../../site/FontSwitcher";
import { InlineToc, StickyToc, useActiveSection } from "../../site/GuideToc";
import { FAQ_HREF, FOUNDATION_HREF, GOVERNANCE_HREF } from "../../site/links";
import { ContractCard, ImpactCard } from "../../site/PageCards";
import { BandHeading, BandHeadingSize, PageShell } from "../../site/PageShell";
import { SITE_COL } from "../../site/ui";

const GUIDE_COLUMN = "max-w-7xl";
/** Lines the title up with the text: SITE_COL's padding, plus the TOC column and gap. */
const GUIDE_HEADER_COLUMN = cn(GUIDE_COLUMN, "lg:pl-[calc(68px+18rem)]");

export function meta() {
  return socialPreviewMeta({
    title: "Guide to the Alliance",
    description: "Our goals, how we divide work, and our next steps.",
    url: "/guide",
  });
}

const GUIDE_TITLE = "Guide to the Alliance";
const GUIDE_LEDE = "Our goals, how we divide work, and our next steps.";
/** Names the table of contents for screen readers; nothing draws it. */
const GUIDE_TOC_LABEL = "Sections";
const TOC_SECTIONS = GUIDE_SECTION_ORDER.map((kind) => ({
  id: kind,
  label: GUIDE_SECTIONS[kind].label,
}));

const GUIDE_QUOTE = {
  lead: "The world is not going in the right direction. We need new ideas. The Alliance is just that,",
  emphasis: "but it will only work if we all participate.",
  name: "Janos Pasztor",
  role: "Former UN Assistant Secretary-General for\nClimate Change",
};

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

function GuideQuote() {
  return (
    <figure
      className="flex gap-3 bg-zinc-100 py-[3.70656rem] pr-[5.77368rem] pl-[4.72392rem] sm:gap-4 sm:py-[4.94208rem] sm:pr-[7.69824rem] sm:pl-[6.29856rem]"
      style={{ borderRadius: "var(--site-radius-card)" }}
    >
      <span
        aria-hidden
        className="site-quote text-[40px] leading-[0.85] sm:text-[54px] text-[var(--site-ink)]"
      >
        “
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[26px]">
        <blockquote className="site-quote text-[22px] leading-[1.15] sm:text-[29px] text-pretty text-[var(--site-ink)]">
          {`${GUIDE_QUOTE.lead} `}
          <span className="text-green">{GUIDE_QUOTE.emphasis}</span>
        </blockquote>
        <figcaption className="flex items-center gap-4 text-[1.05rem] leading-snug">
          <img
            src={janosPasztor}
            alt=""
            className="size-[4.5rem] shrink-0 rounded-md object-cover"
          />
          <span className="flex flex-col">
            <span className="font-semibold">{GUIDE_QUOTE.name}</span>
            <span className="whitespace-pre-line text-[var(--site-ink)]/60">
              {GUIDE_QUOTE.role}
            </span>
          </span>
        </figcaption>
      </div>
    </figure>
  );
}

function PriorityGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {priorities.map((priority) => (
        <article
          key={priority.id}
          className="flex min-h-[133px] flex-col p-7.5 text-white"
          style={{
            borderRadius: "var(--site-radius-card)",
            backgroundColor: "var(--site-primary)",
          }}
        >
          <h3 className="text-[1.4rem] leading-tight">
            {priority.title.replace("\n", " ")}
          </h3>
          <p className="mt-[7px] text-[0.9rem] leading-snug text-white/85">
            {priority.description}
          </p>
        </article>
      ))}
    </div>
  );
}

function CategoryTable() {
  return (
    <div
      className="overflow-hidden"
      style={{ borderRadius: "var(--site-radius-card)" }}
    >
      {ACTION_CATEGORIES.map((category, index) => (
        <div
          key={category.name}
          className={cn(
            "grid gap-2 p-5 sm:grid-cols-[minmax(0,0.4fr)_minmax(0,1fr)] sm:gap-6",
            index % 2 === 0 && " bg-zinc-50",
            index % 2 === 1 && " bg-zinc-100",
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

/** Whatever follows a section's prose. */
const guideExtras: Record<GuideSectionKind, ReactNode> = {
  [GuideSectionKind.Introduction]: null,
  [GuideSectionKind.Structure]: (
    <div className="flex flex-col gap-6">
      <ContractCard caption={GUIDE_CONTRACT_CAPTION} terms />
    </div>
  ),
  [GuideSectionKind.Projects]: (
    <div className="flex flex-col gap-6">
      {/* The two screens a member sees: the action, then what came of it. */}
      <div className="grid gap-3 sm:grid-cols-3">
        {FEATURED_IMPACT_ACTIONS.slice(0, 3).map((action) => (
          <ImpactCard
            key={action.actionId}
            action={action}
            className="bg-zinc-50"
          />
        ))}
      </div>
    </div>
  ),
  [GuideSectionKind.Priorities]: (
    <div className="flex flex-col gap-10">
      <PriorityGrid />
    </div>
  ),
  [GuideSectionKind.Roadmap]: <CategoryTable />,
  [GuideSectionKind.Resources]: <ResourceLinks />,
};

export default function GuidePage() {
  const active = useActiveSection(TOC_SECTIONS);

  return (
    <PageShell
      title={GUIDE_TITLE}
      subtitle={GUIDE_LEDE}
      columnClassName={GUIDE_HEADER_COLUMN}
    >
      <FontSwitcher />
      <StickyToc
        sections={TOC_SECTIONS}
        active={active}
        label={GUIDE_TOC_LABEL}
        columnClassName={GUIDE_COLUMN}
      />
      <div
        className={cn(
          SITE_COL,
          GUIDE_COLUMN,
          "pt-[1.7rem] pb-20 lg:pt-[2.55rem] lg:pb-28",
        )}
      >
        <div className="grid gap-12 lg:grid-cols-[14rem_minmax(0,46rem)] lg:gap-16">
          <InlineToc
            sections={TOC_SECTIONS}
            active={active}
            label={GUIDE_TOC_LABEL}
          />

          <div className="flex flex-col gap-16">
            <GuideQuote />
            {GUIDE_SECTION_ORDER.map((kind) => {
              const section = GUIDE_SECTIONS[kind];
              return (
                <section
                  key={kind}
                  id={kind}
                  className="flex scroll-mt-36 flex-col gap-6 lg:scroll-mt-28"
                >
                  <BandHeading size={BandHeadingSize.Section}>
                    {section.label}
                  </BandHeading>
                  {section.markdown.trim() && (
                    <DocProse
                      markdown={section.markdown}
                      className="[&_:is(p,ul,ol)]:text-[var(--site-ink)]"
                    />
                  )}
                  {guideExtras[kind]}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
