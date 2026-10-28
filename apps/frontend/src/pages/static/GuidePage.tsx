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
import { InlineToc, StickyToc, useActiveSection } from "../../site/GuideToc";
import { FAQ_HREF, FOUNDATION_HREF, GOVERNANCE_HREF } from "../../site/links";
import { ContractCard, ImpactCard } from "../../site/PageCards";
import { BandHeading, BandHeadingSize, PageShell } from "../../site/PageShell";
import { SITE_COL } from "../../site/ui";

const GUIDE_COLUMN = "max-w-7xl";
/** Lines the title up with the text: SITE_COL's padding, plus the TOC column and gap. */
const GUIDE_HEADER_COLUMN = cn(GUIDE_COLUMN, "lg:pl-90");

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
      className="flex gap-3 bg-zinc-100 py-15 pr-11.5 pl-9.5 sm:gap-4 sm:py-20 sm:pr-31 sm:pl-25"
      style={{ borderRadius: "var(--site-radius-card)" }}
    >
      <span
        aria-hidden
        className="site-quote text-5xl leading-10 sm:text-6xl sm:leading-13 text-(--site-ink)"
      >
        “
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-7">
        <blockquote className="site-quote text-2xl leading-7 sm:text-3xl sm:leading-8.5 text-pretty text-(--site-ink)">
          {`${GUIDE_QUOTE.lead} `}
          <span className="text-green">{GUIDE_QUOTE.emphasis}</span>
        </blockquote>
        <figcaption className="flex items-center gap-4 text-base leading-snug">
          <img
            src={janosPasztor}
            alt=""
            className="size-18 shrink-0 rounded-md object-cover"
          />
          <span className="flex flex-col">
            <span className="font-semibold">{GUIDE_QUOTE.name}</span>
            <span className="whitespace-pre-line text-(--site-ink)/60">
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
          className="flex min-h-35.5 flex-col p-7.5 text-white"
          style={{
            borderRadius: "var(--site-radius-card)",
            backgroundColor: "var(--site-primary)",
          }}
        >
          <h3 className="text-2xl leading-tight">
            {priority.title.replace("\n", " ")}
          </h3>
          <p className="mt-2 text-sm leading-snug text-white/85">
            {priority.description}
          </p>
        </article>
      ))}
    </div>
  );
}

function CategoryGrid() {
  return (
    <div className="flex flex-col gap-3">
      {ACTION_CATEGORIES.map((category) => (
        <article
          key={category.name}
          className="grid overflow-hidden sm:grid-cols-20"
          style={{ borderRadius: "var(--site-radius-card)" }}
        >
          <div className="bg-zinc-200 p-7.5 sm:col-span-7">
            <h3 className="text-2xl leading-tight text-(--site-primary)">
              {category.name}
            </h3>
            <p className="mt-2 text-sm leading-snug text-(--site-ink)/60">
              {category.definition}
            </p>
          </div>
          <ul className="flex list-outside list-disc flex-col gap-1.5 bg-zinc-100 p-7.5 pl-12.5 text-base leading-snug text-(--site-ink)/80 sm:col-span-13">
            {category.examples.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        </article>
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
          className="group flex items-center gap-3 border-t border-(--site-ink)/12 py-5 last:border-b"
        >
          <span className="text-lg">
            <span className="font-medium text-(--site-primary) group-hover:underline">
              {resource.label}
            </span>
            <span className="text-(--site-ink)/70">
              {` ${resource.description}`}
            </span>
          </span>
          <SiteArrow className="size-2.5 text-(--site-primary) transition-transform duration-300 ease-out group-hover:translate-x-1 group-hover:-translate-y-1" />
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
            className="bg-zinc-100"
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
  [GuideSectionKind.Roadmap]: <CategoryGrid />,
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
      <StickyToc
        sections={TOC_SECTIONS}
        active={active}
        label={GUIDE_TOC_LABEL}
        columnClassName={GUIDE_COLUMN}
      />
      <div
        className={cn(SITE_COL, GUIDE_COLUMN, "pt-7 pb-20 lg:pt-10 lg:pb-28")}
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
                      className="[&_:is(p,ul,ol)]:text-(--site-ink)"
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
