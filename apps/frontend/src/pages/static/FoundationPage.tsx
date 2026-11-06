import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { ApprovedBy } from "../../site/ApprovedBy";
import {
  FOUNDATION_SECTION_ORDER,
  FOUNDATION_SECTIONS,
} from "../../site/docContent";
import { DocPage, docPageSections } from "../../site/DocPage";

export function meta() {
  return socialPreviewMeta({
    title: "Foundation — The Alliance",
    url: "/foundation",
  });
}

const sections = docPageSections(FOUNDATION_SECTION_ORDER, FOUNDATION_SECTIONS);

export default function FoundationPage() {
  return (
    <DocPage
      title="Foundation"
      subtitle={<ApprovedBy what="principle, aims, and priorities" />}
      sections={sections}
    />
  );
}
