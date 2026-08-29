import { cn } from "@alliance/shared/styles/util";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { ApprovedBy } from "../../site/ApprovedBy";
import {
  GOVERNANCE_MARKDOWN_AFTER,
  GOVERNANCE_MARKDOWN_BEFORE,
} from "../../site/docContent";
import { DocProse } from "../../site/DocProse";
import { ContractCard } from "../../site/PageCards";
import { PageShell } from "../../site/PageShell";
import { SITE_COL } from "../../site/ui";

export function meta() {
  return socialPreviewMeta({
    title: "Governance — The Alliance",
    url: "/governance",
  });
}

export default function GovernancePage() {
  return (
    <PageShell
      title="Governance"
      subtitle={<ApprovedBy what="governance procedures" />}
    >
      <div className={cn(SITE_COL, "pt-16 pb-20 lg:pt-20 lg:pb-28")}>
        <div className="flex max-w-[46rem] flex-col gap-8">
          <DocProse markdown={GOVERNANCE_MARKDOWN_BEFORE} />
          <ContractCard />
          <DocProse markdown={GOVERNANCE_MARKDOWN_AFTER} />
        </div>
      </div>
    </PageShell>
  );
}
