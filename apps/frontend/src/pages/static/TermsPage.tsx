import { cn } from "@alliance/shared/styles/util";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { TERMS_MARKDOWN, TERMS_UPDATED } from "../../site/docContent";
import { DocProse } from "../../site/DocProse";
import { PageShell } from "../../site/PageShell";
import { SITE_COL } from "../../site/ui";

export function meta() {
  return socialPreviewMeta({
    title: "Terms & conditions — The Alliance",
    url: "/terms",
  });
}

export default function TermsPage() {
  return (
    <PageShell title="Terms & conditions" lede={TERMS_UPDATED}>
      <div className={cn(SITE_COL, "pt-16 pb-20 lg:pt-20 lg:pb-28")}>
        <DocProse markdown={TERMS_MARKDOWN} className="max-w-[46rem]" />
      </div>
    </PageShell>
  );
}
