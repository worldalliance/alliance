import { formatPhoneNumberForDisplay } from "@alliance/common/phone";
import type { ReactNode } from "react";
import { Outlet, useLocation, useParams } from "react-router";
import { threadContactName } from "../../lib/memberTexts";
import {
  useNeedsReplyCount,
  useNumberThreadData,
} from "../../lib/useTextThreadsAdmin";
import { PlaceId, RecordId } from "../../places";
import { CountBadge } from "../../shell/CountBadge";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../../ui/Tabs";
import { Page } from "../../ui/templates/Page";
import { usePlaceTabs } from "../../ui/templates/usePlaceTabs";
import { Workspace } from "../../ui/templates/Workspace";
import { AllTab } from "./AllTab";
import { NeedsReplyTab } from "./NeedsReplyTab";
import { ThreadPeople } from "./ThreadPeople";

const TABS = ["needs-reply", "all"] as const;
type Tab = (typeof TABS)[number];

const DESCRIPTION: Record<Tab, string> = {
  "needs-reply":
    "Phone numbers with a text no staff member has answered yet, members or not, longest waiting first.",
  all: "Every phone number that has texted the Alliance or had a text from staff, members or not, latest text first.",
};

const COUNTED: Record<Tab, boolean> = { "needs-reply": true, all: false };

// Needs reply has nothing in the URL; All's crumb keeps its search and page.
const OWN_CRUMB: Record<Tab, boolean> = { "needs-reply": false, all: true };

const BODY: Record<Tab, () => ReactNode> = {
  "needs-reply": () => <NeedsReplyTab />,
  all: () => <AllTab />,
};

/**
 * The layout of `/inbox` and `/inbox/:threadId`: the queues on the left, the
 * child route in the middle (`NoThreadOpen` or `ThreadPage`), the open
 * thread's people on the right. Moving between threads changes only the
 * child, so the list keeps its queue, search, page and scroll.
 */
export default function InboxPage() {
  const { threadId } = useParams();
  const tabs = usePlaceTabs(PlaceId.Inbox, TABS);
  const needsReplyCount = useNeedsReplyCount();
  const open = useNumberThreadData(threadId);
  const { search } = useLocation();
  const current = tabs.items.find((tab) => tab.id === tabs.value);

  const workspace = (
    <Workspace
      navigator={
        <Tabs
          value={tabs.value}
          onValueChange={(next: unknown) => {
            const id = TABS.find((candidate) => candidate === next);
            if (id !== undefined) tabs.onChange(id);
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList aria-label="Queues" className="shrink-0 px-card">
            {tabs.items.map((tab) => (
              <TabsTab key={tab.id} value={tab.id}>
                {tab.label}
                {COUNTED[tab.id] && <CountBadge count={needsReplyCount} />}
              </TabsTab>
            ))}
          </TabsList>
          <TabsPanel
            value={tabs.value}
            className="flex min-h-0 flex-1 flex-col"
          >
            {BODY[tabs.value]()}
          </TabsPanel>
        </Tabs>
      }
      inspector={<ThreadPeople thread={threadId === undefined ? null : open} />}
    >
      <Outlet />
    </Workspace>
  );

  // One element type in one place, so opening a thread doesn't remount the list.
  return threadId === undefined ? (
    <Page fill place={PlaceId.Inbox} description={DESCRIPTION[tabs.value]}>
      {workspace}
    </Page>
  ) : (
    <Page
      fill
      record={RecordId.Thread}
      parents={
        OWN_CRUMB[tabs.value] && current
          ? [{ label: current.label, to: `/inbox${search}` }]
          : []
      }
      title={open.data ? threadContactName(open.data) : undefined}
      description={
        open.data && open.data.members.length > 0
          ? formatPhoneNumberForDisplay(open.data.phoneNumber)
          : ""
      }
    >
      {workspace}
    </Page>
  );
}
