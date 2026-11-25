import type { ComponentType } from "react";
import { useSearchParams } from "react-router";
import FormBuilder from "../pages/FormBuilder";
import FormResponses from "../pages/FormResponses";
import FormSnapshotMigration from "../pages/FormSnapshotMigration";
import { RecordId, RECORDS, selectedTab, TabParam } from "../places";
import { TabLinks } from "../shell/TabbedPlace";

const PAGES: Record<string, ComponentType> = {
  builder: FormBuilder,
  responses: FormResponses,
  versions: FormSnapshotMigration,
};

const tabs = RECORDS.find((record) => record.id === RecordId.Form)?.tabs ?? [];

export default function FormRecord() {
  const [searchParams] = useSearchParams();
  const tab = selectedTab(tabs, searchParams.get(TabParam.Tab));
  const Page = PAGES[tab.id];
  if (!Page) throw new Error(`no page for form tab: ${tab.id}`);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line px-page">
        <TabLinks label="Form tabs" param={TabParam.Tab} tabs={tabs} />
      </div>
      <Page />
    </div>
  );
}
