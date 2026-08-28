import { cn } from "@alliance/shared/styles/util";
import type { ReactNode } from "react";
import { FEATURED_IMPACT_ACTIONS } from "../../../../content/featuredImpactActions";
import { priorities } from "../content";
import {
  ACTION_CATEGORIES,
  GUIDE_CONTRACT_CAPTION,
  GUIDE_SECTION_ORDER,
  GUIDE_SECTIONS,
  GuideSectionKind,
} from "../docContent";
import {
  CommitSignatureCard,
  TaskProgressCard,
  UpdateSlideCard,
} from "../graphics/ProductCards";
import { useActiveSection } from "../hooks";
import { rdHref, RedesignPage } from "../links";
import { GUIDE_LEDE, GUIDE_TITLE, GUIDE_TOC_LABEL } from "../pageContent";
import { DocProse } from "../sections/DocProse";
import { NAV_HEIGHT } from "../sections/Nav";
import { ContractCard, ImpactCard } from "../sections/PageCards";
import { PageShell } from "../sections/PageShell";
import type { RedesignTheme } from "../theme";
import { PRIORITY_TINTS } from "../theme";
import { RD_COL, RdArrow } from "../ui";

/** The three resources the guide hands off to at the end. */
const RESOURCE_LINKS: {
  page: RedesignPage;
  label: string;
  description: string;
}[] = [
  {
    page: RedesignPage.Foundation,
    label: "Our foundation",
    description: "describes how we derived our priorities",
  },
  {
    page: RedesignPage.Governance,
    label: "Our governance",
    description: "describes office and member obligations",
  },
  {
    page: RedesignPage.Faq,
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
            borderRadius: "var(--rd-radius-card)",
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

function CategoryTable() {
  return (
    <div
      className="overflow-hidden border border-[var(--rd-ink)]/12"
      style={{ borderRadius: "var(--rd-radius-card)" }}
    >
      {ACTION_CATEGORIES.map((category, index) => (
        <div
          key={category.name}
          className={cn(
            "grid gap-2 p-5 sm:grid-cols-[minmax(0,0.4fr)_minmax(0,1fr)] sm:gap-6",
            index > 0 && "border-t border-[var(--rd-ink)]/12",
            index % 2 === 1 && "bg-[var(--rd-surface-alt)]/60",
          )}
        >
          <p className="text-[1.02rem] font-medium text-[var(--rd-primary)]">
            {category.name}
          </p>
          <ul className="flex list-outside list-disc flex-col gap-1.5 pl-5 text-[1rem] leading-snug text-[var(--rd-ink)]/75">
            {category.examples.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ResourceLinks({ theme }: { theme: RedesignTheme }) {
  return (
    <div className="flex flex-col">
      {RESOURCE_LINKS.map((resource) => (
        <a
          key={resource.page}
          href={rdHref(theme.version, resource.page)}
          className="group flex items-center gap-3 border-t border-[var(--rd-ink)]/12 py-5 last:border-b"
        >
          <span className="text-[1.08rem]">
            <span className="font-medium text-[var(--rd-primary)] group-hover:underline">
              {resource.label}
            </span>
            <span className="text-[var(--rd-ink)]/70">
              {` ${resource.description}`}
            </span>
          </span>
          <RdArrow className="size-2.5 text-[var(--rd-primary)] transition-transform duration-300 ease-out group-hover:translate-x-1 group-hover:-translate-y-1" />
        </a>
      ))}
    </div>
  );
}

/** Whatever sits between a section's prose and the prose that follows it. */
function guideExtras(
  theme: RedesignTheme,
): Record<GuideSectionKind, ReactNode> {
  return {
    [GuideSectionKind.Introduction]: null,
    [GuideSectionKind.Structure]: (
      <div className="flex flex-col gap-6">
        <ContractCard
          version={theme.version}
          caption={GUIDE_CONTRACT_CAPTION}
        />
        <div className="max-w-[24rem]">
          <CommitSignatureCard />
        </div>
      </div>
    ),
    [GuideSectionKind.Actions]: (
      <div className="flex flex-col gap-6">
        {/* The two screens a member sees: the action, then what came of it. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <TaskProgressCard />
          <UpdateSlideCard />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {FEATURED_IMPACT_ACTIONS.slice(0, 3).map((action) => (
            <ImpactCard
              key={action.actionId}
              action={action}
              className="border border-[var(--rd-ink)]/10"
            />
          ))}
        </div>
      </div>
    ),
    [GuideSectionKind.Priorities]: <PriorityGrid />,
    [GuideSectionKind.Roadmap]: <CategoryTable />,
    [GuideSectionKind.Resources]: <ResourceLinks theme={theme} />,
  };
}

export function RedesignGuidePage({ theme }: { theme: RedesignTheme }) {
  const extras = guideExtras(theme);
  const active = useActiveSection(GUIDE_SECTION_ORDER);

  return (
    <PageShell
      theme={theme}
      page={RedesignPage.Guide}
      title={GUIDE_TITLE}
      lede={GUIDE_LEDE}
    >
      <div className={cn(RD_COL, "pt-16 pb-20 lg:pt-20 lg:pb-28")}>
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
                        ? "font-semibold text-[var(--rd-primary)]"
                        : "text-[var(--rd-ink)]/60 hover:text-[var(--rd-primary)]",
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
                  <h2 className="rd-headline text-[1.9rem] leading-tight text-[var(--rd-primary)] sm:text-[2.2rem]">
                    {section.label}
                  </h2>
                  {section.markdown.trim() && (
                    <DocProse
                      version={theme.version}
                      markdown={section.markdown}
                    />
                  )}
                  {extras[kind]}
                  {section.markdownAfter && (
                    <DocProse
                      version={theme.version}
                      markdown={section.markdownAfter}
                    />
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
