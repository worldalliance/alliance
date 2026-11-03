import { linkHints } from "@alliance/shared/lib/copy";
import { ExternalLink } from "lucide-react";

/** Goes inside a link that opens a new tab, after its text. */
export default function NewTabMark() {
  return (
    <ExternalLink
      role="img"
      aria-label={linkHints.opensInNewTab}
      className="ml-0.5 inline size-[0.85em] -translate-y-px align-baseline"
    />
  );
}
