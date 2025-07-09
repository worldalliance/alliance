import { useState } from "react";
import { HomeTaskView } from "../../components/HomeTaskView";
import { actionsComplete } from "@alliance/shared/client";
import { HomeNewActionsView } from "../../components/HomeNewActionsView";
import GatheringCommitmentsView from "../../components/GatheringCommitmentsView";
import { getActionDataFromMatches, RouteMatches } from "../../applayout";

const HomePage = ({ matches }: RouteMatches) => {
  const [error, setError] = useState<string | null>(null);

  const actions = getActionDataFromMatches(matches);

  if (!actions) {
    return <div>Error loading actions</div>;
  }

  const todoActions = actions.filter(
    (action) =>
      action.myRelation?.status === "joined" &&
      action.status === "member_action"
  );

  const newActions = actions.filter(
    (action) =>
      !action.myRelation ||
      (action.myRelation.status === "none" &&
        action.status === "gathering_commitments")
  );

  const committedActions = actions.filter(
    (action) =>
      action.myRelation?.status === "joined" &&
      action.status === "gathering_commitments"
  );

  const handleTaskComplete = (actionId: number) => {
    actionsComplete({ path: { id: actionId.toString() } }).then(() => {
      window.location.reload();
    });
  };

  return (
    <div className="flex flex-col w-full h-full items-center bg-white">
      <div className="flex flex-col py-16 max-w-[728px] md:min-w-[600px] gap-y-5 overflow-y-auto px-3">
        {error && <p className="text-red-500">{error}</p>}
        <div className="flex flex-col gap-y-8">
          {todoActions.length > 0 && (
            <HomeTaskView
              actions={todoActions.slice(0, 2)}
              onTaskComplete={handleTaskComplete}
            />
          )}
          <HomeNewActionsView actions={newActions} />
          <GatheringCommitmentsView actions={committedActions} />
          {/* <InviteMemberCard /> */}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
