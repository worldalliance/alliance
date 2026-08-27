import { cn } from "@alliance/shared/styles/util";
import {
  GOVERNANCE_INTRO,
  GOVERNANCE_MARKDOWN_AFTER,
  GOVERNANCE_MARKDOWN_BEFORE,
} from "../docContent";
import { RedesignPage } from "../links";
import { GOVERNANCE_TITLE } from "../pageContent";
import { DocProse } from "../sections/DocProse";
import { ContractCard } from "../sections/PageCards";
import { PageShell } from "../sections/PageShell";
import type { RedesignTheme } from "../theme";
import { RD_COL } from "../ui";

export function RedesignGovernancePage({ theme }: { theme: RedesignTheme }) {
  return (
    <PageShell
      theme={theme}
      page={RedesignPage.Governance}
      title={GOVERNANCE_TITLE}
      lede={GOVERNANCE_INTRO}
    >
      <div
        className={cn(RD_COL, "flex max-w-[46rem] flex-col gap-8 pt-16 pb-20 lg:pt-20 lg:pb-28")}
      >
        <DocProse
          version={theme.version}
          markdown={GOVERNANCE_MARKDOWN_BEFORE}
        />
        <ContractCard version={theme.version} />
        <DocProse
          version={theme.version}
          markdown={GOVERNANCE_MARKDOWN_AFTER}
        />
      </div>
    </PageShell>
  );
}
