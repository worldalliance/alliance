import Card, { CardStyle } from "@alliance/shared/ui/Card";
import CheckIcon from "@alliance/shared/ui/icons/CheckIcon";
import { Link, useNavigate, useOutletContext } from "react-router";
import { ActionWithRelation, AppLayoutOutletContext } from "../../applayout";
import ActionActivityFeedItem from "../../components/ActionActivityFeedItem";
import ForumListPost from "../../components/ForumListPost";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import LargeActionCard from "./LargeActionCard";
import SmallActionCard from "./SmallActionCard";
import useActivities, { ActivityList } from "./useActivities";
import BasicErrorMessage from "../../components/BasicErrorMessage";
import { useAuth } from "../../lib/AuthContext";
import Spinner from "../../components/Spinner";
import { getPastEvents } from "@alliance/shared/lib/actionUtils";
import { useCIDFromParams } from "../../lib/utils";

export function canCompleteAction(action: ActionWithRelation) {
  return (
    getPastEvents(action).some(
      (event) => event.newStatus === "member_action"
    ) &&
    (action.relation === "joined" ||
      (action.commitmentless && action.relation !== "completed")) &&
    action.relation !== "declined" &&
    action.canParticipate
  );
}

export function shouldCompleteAction(action: ActionWithRelation) {
  return (
    canCompleteAction(action) &&
    action.shouldParticipate &&
    (action.status === "member_action" ||
      action.status === "gathering_commitments")
  );
}

export function canJoinAction(action: ActionWithRelation) {
  return (
    action.status === "gathering_commitments" &&
    action.relation === "none" &&
    action.canParticipate
  );
}

const HomePage = () => {
  const navigate = useNavigate();
  const { actions, posts, loading } =
    useOutletContext<AppLayoutOutletContext>();

  const { activities: friendActivities, handleLikeActivity } = useActivities({
    list: ActivityList.Friends,
  });

  useCIDFromParams();

  const { user } = useAuth();

  const mainContent = () => {
    if (actions === null) {
      return loading ? (
        <Spinner size="large" />
      ) : (
        <BasicErrorMessage>Error loading actions</BasicErrorMessage>
      );
    }

    const todoActions = actions.filter((action) =>
      shouldCompleteAction(action)
    );
    const newActions = actions
      .filter((action) => canJoinAction(action))
      .sort((a, b) => {
        return a.priority - b.priority;
      });

    const committedActions = actions.filter(
      (action) =>
        action.relation === "joined" &&
        action.status === "gathering_commitments" &&
        action.canParticipate
    );

    const commitmentsReachedActions = actions.filter(
      (action) =>
        action.relation === "joined" && action.status === "office_action"
    );

    const currentTask = newActions[0] || todoActions[0] || null;
    const remainingTasksEstimatedTime = todoActions.reduce((sum, action) => {
      if (action.timeEstimate) {
        return sum + action.timeEstimate;
      }
      return sum;
    }, 0);

    return (
      <div className="flex flex-col gap-y-2 border-zinc-200 w-full items-center">
        <div
          className={
            "md:min-h-[calc(100vh-var(--nav-height) - 2px)] pb-12 flex flex-col items-center w-xl lg:w-2xl max-w-full"
          }
        >
          <div className="mb-8">
            <p className="font-serif text-center font-semibold text-3xl mt-12 sm:mt-16 lg:mt-28">
              Current task
            </p>
            {todoActions.length + newActions.length > 0 && (
              <p className="mt-1 text-zinc-500 text-center px-4">
                {todoActions.length + newActions.length} left
                {todoActions.length > 0 &&
                  ` for a total of ${remainingTasksEstimatedTime} minutes`}
              </p>
            )}
          </div>
          {currentTask && currentTask.relation ? (
            <LargeActionCard
              action={currentTask}
              userRelation={currentTask.relation as "joined" | "none"}
              friendActivities={friendActivities.filter(
                (activity) => activity.actionId === currentTask.id
              )}
              onUpdateActionState={() => navigate(window.location.pathname)}
            />
          ) : (
            <Card style={CardStyle.Transparent} className="w-full">
              <div className="px-2 py-36 flex flex-col items-center gap-y-4">
                {user?.contractDateSuspended ? (
                  <p className="text-center text-zinc-500">
                    You will not be given new tasks while your contract is
                    suspended.
                  </p>
                ) : (
                  <>
                    <CheckIcon size="large" />
                    <p className="text-center text-zinc-500 text-lg">
                      Nothing to do right now!
                    </p>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>

        {(todoActions.filter((action) => action.id !== currentTask?.id).length >
          0 ||
          newActions.filter((action) => action.id !== currentTask?.id).length >
            0 ||
          committedActions.length > 0 ||
          commitmentsReachedActions.length > 0) && (
          <div className="pb-20 flex flex-col items-center w-xl lg:w-2xl max-w-full">
            <p className="mb-8 font-serif font-semibold text-3xl text-center">
              Up next
            </p>
            <div className="flex flex-col gap-y-2 w-full">
              {todoActions
                .filter((action) => action.id !== currentTask?.id)
                .map((action) => (
                  <SmallActionCard
                    key={action.id}
                    action={action}
                    showDescription={true}
                    friendActivities={friendActivities.filter(
                      (activity) =>
                        activity.actionId === action.id &&
                        activity.type === "user_completed"
                    )}
                  />
                ))}
              {newActions
                .filter((action) => action.id !== currentTask?.id)
                .map((action) => (
                  <SmallActionCard
                    key={action.id}
                    action={action}
                    showDescription={true}
                  />
                ))}
              {committedActions.map((action) => (
                <SmallActionCard
                  key={action.id}
                  action={action}
                  friendActivities={friendActivities.filter(
                    (activity) =>
                      activity.actionId === action.id &&
                      activity.type === "user_joined"
                  )}
                  showDescription={false}
                />
              ))}
              {commitmentsReachedActions.map((action) => (
                <SmallActionCard
                  key={action.id}
                  action={action}
                  friendActivities={friendActivities.filter(
                    (activity) =>
                      activity.actionId === action.id &&
                      activity.type === "user_joined"
                  )}
                  showDescription={false}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  useWhiteBackground();

  const bulletinCard = (
    <div>
      <p className="font-semibold text-xl text-black mb-2 font-serif">
        Bulletin
      </p>
      <p className="text-black mb-2">
        Right now, we are focused on small-scale experiments that test
        collective action strategies. Learn more about our current{" "}
        <Link to="/priorities" className="text-link">
          priorities
        </Link>
        .
      </p>
    </div>
  );

  return (
    <div className={`flex flex-col w-full items-center bg-white`}>
      <div className="flex flex-row w-full justify-between">
        <div
          className="flex flex-col gap-y-5 overflow-y-auto flex-1 items-center px-3 sm:px-5 relative overflow-x-hidden"
          style={{ height: `calc(100dvh - var(--nav-height) - 2px)` }}
        >
          {mainContent()}
        </div>
        <div
          className={`hidden border-l pl-6 pr-10 border-zinc-200 md:flex flex-col py-2 gap-y-5 sticky top-[var(--nav-height)] h-[calc(100vh-var(--nav-height))]  items-stretch w-[380px] overflow-y-auto`}
        >
          <div className="flex flex-col divide-y *:py-5 *:px-2 divide-zinc-200">
            <div className="flex">{bulletinCard}</div>
            <div>
              <p className="font-semibold text-xl font-serif text-black">
                Forum activity
              </p>
              {posts && posts.length === 0 && (
                <p className="text-zinc-400 mt-3">No activity yet.</p>
              )}
              {posts && posts.length > 0 && (
                <div className="flex flex-col *:py-3 -mb-3">
                  {posts
                    .filter(
                      (post) =>
                        !post.visibleAt || new Date(post.visibleAt) < new Date()
                    )
                    .slice(0, 2)
                    .map((post) => (
                      <ForumListPost
                        key={post.id}
                        post={post}
                        card={false}
                        showAction={false}
                      />
                    ))}
                </div>
              )}
            </div>
            <div className="!overflow-y-auto">
              <div className="flex flex-row justify-between items-center mb-3">
                <p className="font-semibold text-xl font-serif text-black">
                  Friend activity
                </p>
                {friendActivities.length > 0 && (
                  <Link to="/feed" className="text-link text-sm mt-0">
                    See all
                  </Link>
                )}
              </div>
              <div className="flex flex-col *:py-3 -my-3">
                {friendActivities.length === 0 && (
                  <div className="space-x-1">
                    <span className="text-zinc-400 mb-3">No activity yet.</span>
                    <a href="/members" className="text-link">
                      Find friends
                    </a>
                  </div>
                )}
                {friendActivities.slice(0, 2).map((activity) => (
                  <ActionActivityFeedItem
                    key={activity.id}
                    activity={activity}
                    showTime={false}
                    card={false}
                    showAction={true}
                    handleLike={() => handleLikeActivity(activity.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
