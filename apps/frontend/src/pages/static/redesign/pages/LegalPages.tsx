import { cn } from "@alliance/shared/styles/util";
import {
  PRIVACY_MARKDOWN,
  PRIVACY_UPDATED,
  TERMS_MARKDOWN,
  TERMS_UPDATED,
} from "../docContent";
import { RedesignPage } from "../links";
import { PRIVACY_TITLE, TERMS_TITLE } from "../pageContent";
import { DocProse } from "../sections/DocProse";
import { PageShell } from "../sections/PageShell";
import type { RedesignTheme } from "../theme";
import { RD_COL } from "../ui";

/** Privacy and terms are the same page with different words in it. */
function LegalPage({
  theme,
  page,
  title,
  updated,
  markdown,
}: {
  theme: RedesignTheme;
  page: RedesignPage;
  title: string;
  updated: string;
  markdown: string;
}) {
  return (
    <PageShell theme={theme} page={page} title={title} lede={updated}>
      <div className={cn(RD_COL, "pt-16 pb-20 lg:pt-20 lg:pb-28")}>
        <DocProse
          version={theme.version}
          markdown={markdown}
          className="max-w-[46rem]"
        />
      </div>
    </PageShell>
  );
}

export function RedesignPrivacyPage({ theme }: { theme: RedesignTheme }) {
  return (
    <LegalPage
      theme={theme}
      page={RedesignPage.Privacy}
      title={PRIVACY_TITLE}
      updated={PRIVACY_UPDATED}
      markdown={PRIVACY_MARKDOWN}
    />
  );
}

export function RedesignTermsPage({ theme }: { theme: RedesignTheme }) {
  return (
    <LegalPage
      theme={theme}
      page={RedesignPage.Terms}
      title={TERMS_TITLE}
      updated={TERMS_UPDATED}
      markdown={TERMS_MARKDOWN}
    />
  );
}
