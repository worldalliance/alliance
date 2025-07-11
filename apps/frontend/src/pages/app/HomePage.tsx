import { actionsComplete, UserActionDto } from "@alliance/shared/client";
import { getLoadedActionData, RouteMatches } from "../../applayout";
import TaskCard from "../../components/TaskCard";
import ActionItemCard from "../../components/ActionItemCard";

const HomePage = ({ matches }: RouteMatches) => {
  const { actions, relations } = getLoadedActionData(matches);

  if (!actions) {
    return <div>Error loading actions</div>;
  }

  console.log(relations);

  const todoActions = actions.filter(
    (action) =>
      relations.get(action.id) === "joined" && action.status === "member_action"
  );

  const newActions = actions.filter(
    (action) =>
      !relations.get(action.id) ||
      (relations.get(action.id) === "none" &&
        action.status === "gathering_commitments")
  );

  const committedActions = actions.filter(
    (action) =>
      relations.get(action.id) === "joined" &&
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
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-row items-center gap-x-2">
                <p className="font-semibold text-sm text-zinc-500">
                  Awaiting Completion
                </p>
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-zinc-500 bg-zinc-200 rounded-full">
                  {todoActions.slice(0, 2).length}
                </span>
              </div>
              {todoActions.slice(0, 2).map((action) => (
                <TaskCard
                  key={action.id}
                  action={action}
                  onComplete={handleTaskComplete}
                />
              ))}
            </div>
          )}
          {newActions.length > 0 && (
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-row items-center gap-x-2">
                <p className="font-semibold text-sm text-zinc-500">
                  Awaiting Commitment
                </p>
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-zinc-500 bg-zinc-200 rounded-full">
                  {newActions.length}
                </span>
              </div>
              {newActions.map((action) => (
                <ActionItemCard
                  key={action.id}
                  {...action}
                  showDescription={true}
                />
              ))}
            </div>
          )}
          {committedActions.length > 0 && (
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-row items-center gap-x-2">
                <p className="font-semibold text-sm text-zinc-500">
                  Still gathering commitments
                </p>
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-zinc-500 bg-zinc-200 rounded-full">
                  {committedActions.length}
                </span>
              </div>
              {committedActions.map((action) => (
                <ActionItemCard
                  key={action.id}
                  {...action}
                  showDescription={false}
                />
              ))}
            </div>
          )}
          {/* <InviteMemberCard /> */}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
