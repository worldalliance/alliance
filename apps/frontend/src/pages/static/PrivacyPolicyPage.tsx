import { cn } from "@alliance/shared/styles/util";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { PRIVACY_MARKDOWN, PRIVACY_UPDATED } from "../../site/docContent";
import { DocProse } from "../../site/DocProse";
import { PageShell } from "../../site/PageShell";
import { SITE_COL } from "../../site/ui";

export function meta() {
  return socialPreviewMeta({
    title: "Privacy policy — The Alliance",
    url: "/privacypolicy",
  });
}

export default function PrivacyPolicyPage() {
  return (
    <PageShell title="Privacy policy" lede={PRIVACY_UPDATED}>
      <div className={cn(SITE_COL, "pt-16 pb-20 lg:pt-20 lg:pb-28")}>
        <DocProse markdown={PRIVACY_MARKDOWN} className="max-w-[46rem]" />
      </div>
    </PageShell>
  );
}
