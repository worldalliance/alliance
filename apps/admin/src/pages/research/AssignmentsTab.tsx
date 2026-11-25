import { KoraNoticeKind } from "../../lib/useKoraParticipantsAdmin";
import { OverviewGrid } from "../../ui/templates/Overview";
import { PageBody } from "../../ui/templates/Page";
import { ConversationsPanel } from "./ConversationsPanel";
import { NotifyPanel } from "./NotifyPanel";
import { ProjectStatusPanel } from "./ProjectStatusPanel";
import { ResultsPanel } from "./ResultsPanel";
import { TranscriptsSection } from "./TranscriptsSection";

export function AssignmentsTab() {
  return (
    <PageBody>
      <ProjectStatusPanel />
      <TranscriptsSection />
      <OverviewGrid>
        <NotifyPanel notice={KoraNoticeKind.Launch} />
        <NotifyPanel notice={KoraNoticeKind.More} />
      </OverviewGrid>
      <ConversationsPanel />
      <ResultsPanel />
    </PageBody>
  );
}
