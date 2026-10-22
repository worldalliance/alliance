import {
  GOVERNANCE_MARKDOWN_AFTER,
  GOVERNANCE_MARKDOWN_BEFORE,
} from "./docContent";
import { DocProse, DocProseSize } from "./DocProse";
import { ContractCard } from "./PageCards";

/**
 * What the governance page says, in the order it says it. The agreement dialog
 * renders this too, so a section added or moved here reaches both.
 */
export function GovernanceBody({
  size = DocProseSize.Default,
}: {
  size?: DocProseSize;
}) {
  return (
    <>
      <DocProse markdown={GOVERNANCE_MARKDOWN_BEFORE} size={size} />
      <ContractCard size={size} />
      <DocProse markdown={GOVERNANCE_MARKDOWN_AFTER} size={size} />
    </>
  );
}
