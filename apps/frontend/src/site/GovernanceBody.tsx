import {
  GOVERNANCE_MEMBERSHIP_AFTER,
  GOVERNANCE_SECTION_ORDER,
  GOVERNANCE_SECTIONS,
  GovernanceSectionKind,
  type DocSectionCopy,
} from "./docContent";
import { DocProse, DocProseSize } from "./DocProse";
import { ContractCard } from "./PageCards";

function headed(section: DocSectionCopy): string {
  return `## ${section.label}\n\n${section.markdown}`;
}

function afterContractMarkdown(): string {
  const chunks: string[] = [GOVERNANCE_MEMBERSHIP_AFTER];
  for (const kind of GOVERNANCE_SECTION_ORDER) {
    switch (kind) {
      case GovernanceSectionKind.Membership:
        break;
      case GovernanceSectionKind.Office:
      case GovernanceSectionKind.Oversight:
        chunks.push(headed(GOVERNANCE_SECTIONS[kind]));
        break;
      default:
        throw new Error(`unknown kind: ${kind satisfies never}`);
    }
  }
  return chunks.join("\n");
}

/** Compact markdown headings for the agreement dialog; the public page uses DocPage. */
export function GovernanceBody({
  size = DocProseSize.Default,
}: {
  size?: DocProseSize;
}) {
  return (
    <>
      <DocProse
        markdown={headed(GOVERNANCE_SECTIONS[GovernanceSectionKind.Membership])}
        size={size}
      />
      <ContractCard size={size} />
      <DocProse markdown={afterContractMarkdown()} size={size} />
    </>
  );
}
