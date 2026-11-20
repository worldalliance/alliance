import ActionCohortDecisionsTab from "../../components/ActionCohortDecisionsTab";
import ActionMergedResponsesTab from "../../components/ActionMergedResponsesTab";
import Tabs, { TabsStyle } from "../../components/ui/Tabs";
import { useSearchParamTab } from "../../lib/useSearchParamTab";
import { ResponsesView, VIEW_PARAM } from "./workspaceLocation";

const VIEWS = [
  { key: ResponsesView.Responses, label: "Responses" },
  { key: ResponsesView.CohortDecisions, label: "Cohort decisions" },
];

const ActionResponsesTab = ({ actionId }: { actionId: number }) => {
  const [view, , viewHref] = useSearchParamTab(
    VIEWS.map(({ key }) => key),
    ResponsesView.Responses,
    { param: VIEW_PARAM },
  );
  return (
    <div className="flex flex-col gap-y-3">
      <Tabs
        label="Responses views"
        items={VIEWS}
        current={view}
        href={viewHref}
        style={TabsStyle.Segmented}
      />
      {(() => {
        switch (view) {
          case ResponsesView.Responses:
            return (
              <ActionMergedResponsesTab
                actionId={actionId}
                paramNamespace="resp"
              />
            );
          case ResponsesView.CohortDecisions:
            return <ActionCohortDecisionsTab actionId={actionId} />;
          default:
            throw new Error(`unknown view: ${view satisfies never}`);
        }
      })()}
    </div>
  );
};

export default ActionResponsesTab;
