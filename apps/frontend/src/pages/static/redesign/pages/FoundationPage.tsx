import { cn } from "@alliance/shared/styles/util";
import { FOUNDATION_INTRO, FOUNDATION_MARKDOWN } from "../docContent";
import { RedesignPage } from "../links";
import { FOUNDATION_TITLE } from "../pageContent";
import { DocProse } from "../sections/DocProse";
import { PageShell } from "../sections/PageShell";
import type { RedesignTheme } from "../theme";
import { RD_COL } from "../ui";

export function RedesignFoundationPage({ theme }: { theme: RedesignTheme }) {
  return (
    <PageShell
      theme={theme}
      page={RedesignPage.Foundation}
      title={FOUNDATION_TITLE}
      lede={FOUNDATION_INTRO}
    >
      <div className={cn(RD_COL, "pt-16 pb-20 lg:pt-20 lg:pb-28")}>
        <DocProse
          version={theme.version}
          markdown={FOUNDATION_MARKDOWN}
          className="max-w-[46rem]"
        />
      </div>
    </PageShell>
  );
}
