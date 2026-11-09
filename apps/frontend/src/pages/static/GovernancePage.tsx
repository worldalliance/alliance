import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { ApprovedBy } from "../../site/ApprovedBy";
import {
  GOVERNANCE_MEMBERSHIP_AFTER,
  GOVERNANCE_SECTION_ORDER,
  GOVERNANCE_SECTIONS,
  GovernanceSectionKind,
} from "../../site/docContent";
import { DOC_PROSE_CLASS, DocPage, docPageSections } from "../../site/DocPage";
import { DocProse } from "../../site/DocProse";
import { ContractCard } from "../../site/PageCards";

export function meta() {
  return socialPreviewMeta({
    title: "Governance — The Alliance",
    url: "/governance",
  });
}

const sections = docPageSections(
  GOVERNANCE_SECTION_ORDER,
  GOVERNANCE_SECTIONS,
  {
    [GovernanceSectionKind.Membership]: (
      <>
        <ContractCard />
        <DocProse
          markdown={GOVERNANCE_MEMBERSHIP_AFTER}
          className={DOC_PROSE_CLASS}
        />
      </>
    ),
  },
);

export default function GovernancePage() {
  return (
    <DocPage
      title="Governance"
      subtitle={<ApprovedBy what="governance procedures" />}
      sections={sections}
    />
  );
}
