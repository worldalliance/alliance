import { HomeTaskView } from "../../components/HomeTaskView";
import { actionsComplete, UserActionDto } from "@alliance/shared/client";
import { HomeNewActionsView } from "../../components/HomeNewActionsView";
import GatheringCommitmentsView from "../../components/GatheringCommitmentsView";
import { getLoadedActionData, RouteMatches } from "../../applayout";

const HomePage = ({ matches }: RouteMatches) => {
  const { actions, relations } = getLoadedActionData(matches);

  const actionToRelationMap = new Map<number, UserActionDto["status"]>();
  relations.forEach((relation) => {
    actionToRelationMap.set(relation.actionId, relation.status);
  });

  if (!actions) {
    return <div>Error loading actions</div>;
  }

  console.log(relations);
  console.log(actionToRelationMap);

  const todoActions = actions.filter(
    (action) =>
      actionToRelationMap.get(action.id) === "joined" &&
      action.status === "member_action"
  );

  const newActions = actions.filter(
    (action) =>
      !actionToRelationMap.get(action.id) ||
      (actionToRelationMap.get(action.id) === "none" &&
        action.status === "gathering_commitments")
  );

  const committedActions = actions.filter(
    (action) =>
      actionToRelationMap.get(action.id) === "joined" &&
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
