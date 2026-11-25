import type { ReactNode } from "react";
import { useState } from "react";
import { inviteFeedHref } from "../../lib/hrefs";
import { PlaceId } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { Page } from "../../ui/templates/Page";
import { usePlaceTabs } from "../../ui/templates/usePlaceTabs";
import InviteGraphPage from "../InviteGraphPage";
import { InviteLinksTab } from "./InviteLinksTab";
import { InvitesTab } from "./InvitesTab";
import { LiveFeedTab } from "./LiveFeedTab";
import { MessageTemplateTab } from "./MessageTemplateTab";
import { NewInviteDialog } from "./NewInviteDialog";

const TABS = ["invites", "links", "graph", "feed", "template"] as const;
type Tab = (typeof TABS)[number];

// The lists and the graph fill the frame; the feed and the form scroll with it.
const FILLS: Record<Tab, boolean> = {
  invites: true,
  links: true,
  graph: true,
  feed: false,
  template: false,
};

export default function InvitesPage() {
  const tabs = usePlaceTabs(PlaceId.Invites, TABS);
  const [creating, setCreating] = useState(false);
  // A new invite is the newest, so the list starts again from its first page.
  const [listKey, setListKey] = useState(0);

  const actions: Record<Tab, ReactNode> = {
    invites: (
      <Button variant={ButtonVariant.Primary} onClick={() => setCreating(true)}>
        New invite…
      </Button>
    ),
    links: null,
    graph: null,
    feed: (
      <Button variant={ButtonVariant.Default} to={inviteFeedHref}>
        Full screen
      </Button>
    ),
    template: null,
  };

  const body: Record<Tab, () => ReactNode> = {
    invites: () => (
      <InvitesTab key={listKey} onNewInvite={() => setCreating(true)} />
    ),
    links: () => <InviteLinksTab />,
    graph: () => <InviteGraphPage />,
    feed: () => <LiveFeedTab />,
    template: () => <MessageTemplateTab />,
  };

  return (
    <Page
      fill={FILLS[tabs.value]}
      place={PlaceId.Invites}
      description="One-time invites and invite links, who invited whom, and the message members send with an invite."
      actions={actions[tabs.value]}
      tabs={tabs}
    >
      {body[tabs.value]()}
      {creating && (
        <NewInviteDialog
          onClose={() => setCreating(false)}
          onCreated={() => setListKey((key) => key + 1)}
        />
      )}
    </Page>
  );
}
