import type { ReactNode } from "react";
import { PlaceId } from "../../places";
import { Page } from "../../ui/templates/Page";
import { usePlaceTabs } from "../../ui/templates/usePlaceTabs";
import { AssignmentsTab } from "./AssignmentsTab";
import { ParticipantsTab } from "./ParticipantsTab";

const TABS = ["participants", "assignments"] as const;
type Tab = (typeof TABS)[number];

const BODY: Record<Tab, () => ReactNode> = {
  participants: () => <ParticipantsTab />,
  assignments: () => <AssignmentsTab />,
};

// The people list fills the frame under its search; the project's sections scroll with it.
const FILLS: Record<Tab, boolean> = { participants: true, assignments: false };

export default function KoraParticipantsPage() {
  const tabs = usePlaceTabs(PlaceId.KoraParticipants, TABS);
  return (
    <Page
      fill={FILLS[tabs.value]}
      place={PlaceId.KoraParticipants}
      description="The Safer Chatbots for Children review project: the people who signed up on its page, and the transcripts they review."
      tabs={tabs}
    >
      {BODY[tabs.value]()}
    </Page>
  );
}
