import type { ReactNode } from "react";
import { PlaceId } from "../../places";
import { Page } from "../../ui/templates/Page";
import { usePlaceTabs } from "../../ui/templates/usePlaceTabs";
import { CustomLinksTab } from "./CustomLinksTab";
import { HostedDocsTab } from "./HostedDocsTab";
import { ShareLinksTab } from "./ShareLinksTab";
import { ShareTargetsTab } from "./ShareTargetsTab";

const TABS = [
  "share-links",
  "custom-links",
  "share-targets",
  "hosted-docs",
] as const;
type Tab = (typeof TABS)[number];

const BODY: Record<Tab, () => ReactNode> = {
  "share-links": () => <ShareLinksTab />,
  "custom-links": () => <CustomLinksTab />,
  "share-targets": () => <ShareTargetsTab />,
  "hosted-docs": () => <HostedDocsTab />,
};

export default function LinksPage() {
  const tabs = usePlaceTabs(PlaceId.Links, TABS);
  return (
    <Page
      fill
      place={PlaceId.Links}
      description="Links handed to people outside the admin: share links, short custom links, the share targets forms link to, and hosted PDFs."
      tabs={tabs}
    >
      {BODY[tabs.value]()}
    </Page>
  );
}
