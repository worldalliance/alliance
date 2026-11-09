import { cn } from "@alliance/shared/styles/util";
import { useMemo, type ReactNode } from "react";
import { DocProse } from "./DocProse";
import { InlineToc, StickyToc, useActiveSection } from "./GuideToc";
import { BandHeading, BandHeadingSize, PageShell } from "./PageShell";
import { SITE_COL } from "./ui";

/** Lines the title up with the centered text: its 45rem plus SITE_COL's padding. */
export const DOC_HEADER_COLUMN = "lg:max-w-216";

/** Names the table of contents for screen readers; nothing draws it. */
export const DOC_TOC_LABEL = "Sections";

export const DOC_PROSE_CLASS =
  "*:not-first:mt-6 [&_:is(p,ul,ol)]:text-(--site-ink)";

export type DocPageSection = {
  id: string;
  label: string;
  markdown: string;
  extra?: ReactNode;
};

export function docPageSections<K extends string>(
  order: readonly K[],
  copy: Record<K, { label: string; markdown: string }>,
  extras?: Partial<Record<K, ReactNode>>,
): DocPageSection[] {
  return order.map((id) => ({
    id,
    label: copy[id].label,
    markdown: copy[id].markdown,
    extra: extras?.[id],
  }));
}

export function DocPage({
  title,
  subtitle,
  sections,
  preamble,
  tocLabel = DOC_TOC_LABEL,
}: {
  title: string;
  subtitle?: ReactNode;
  sections: DocPageSection[];
  preamble?: ReactNode;
  tocLabel?: string;
}) {
  const toc = useMemo(
    () => sections.map(({ id, label }) => ({ id, label })),
    [sections],
  );
  const active = useActiveSection(toc);

  return (
    <PageShell
      title={title}
      subtitle={subtitle}
      columnClassName={DOC_HEADER_COLUMN}
    >
      <StickyToc sections={toc} active={active} label={tocLabel} />
      <div className={cn(SITE_COL, "pt-7 pb-20 lg:pt-20 lg:pb-28")}>
        <div className="grid gap-12 lg:grid-cols-[minmax(8rem,1fr)_minmax(0,45rem)_minmax(8rem,1fr)] lg:gap-x-16 2xl:gap-x-42">
          <InlineToc sections={toc} active={active} label={tocLabel} />

          <div className="flex flex-col gap-16">
            {preamble}
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="flex scroll-mt-36 flex-col gap-6 lg:scroll-mt-28"
              >
                <BandHeading size={BandHeadingSize.Section}>
                  {section.label}
                </BandHeading>
                {section.markdown.trim() && (
                  <DocProse
                    markdown={section.markdown}
                    className={DOC_PROSE_CLASS}
                  />
                )}
                {section.extra}
              </section>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
