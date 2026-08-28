import { cn } from "@alliance/shared/styles/util";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { ApprovedBy } from "../../site/ApprovedBy";
import { FOUNDATION_MARKDOWN } from "../../site/docContent";
import { DocProse } from "../../site/DocProse";
import { PageShell } from "../../site/PageShell";
import { SITE_COL } from "../../site/ui";

export function meta() {
  return socialPreviewMeta({
    title: "Foundation — The Alliance",
    url: "/foundation",
  });
}

export default function FoundationPage() {
  return (
    <PageShell
      title="Foundation"
      lede={<ApprovedBy what="principle, aims, and priorities" />}
    >
      <div className={cn(SITE_COL, "pt-16 pb-20 lg:pt-20 lg:pb-28")}>
        <DocProse markdown={FOUNDATION_MARKDOWN} className="max-w-[46rem]" />
      </div>
    </PageShell>
  );
}
