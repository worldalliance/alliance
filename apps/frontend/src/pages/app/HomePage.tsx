import CheckIcon from "@alliance/shared/ui/icons/CheckIcon";
import { Link, useNavigate, useOutletContext } from "react-router";
import { ActionWithRelation, AppLayoutOutletContext } from "../../applayout";
import ActionActivityFeedItem from "../../components/ActionActivityFeedItem";
import ForumListPost from "../../components/ForumListPost";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import LargeActionCard from "./LargeActionCard";
import useActivities, { ActivityList } from "./useActivities";
import BasicErrorMessage from "../../components/BasicErrorMessage";
import { useAuth } from "../../lib/AuthContext";
import Spinner from "../../components/Spinner";
import { getPastEvents } from "@alliance/shared/lib/actionUtils";
import { useCIDFromParams } from "../../lib/utils";
import TwoColumnLayout from "../../components/TwoColumnLayout";

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

  const todoActions =
    actions?.filter((action) => shouldCompleteAction(action)) || [];
  const newActions =
    actions
      ?.filter((action) => canJoinAction(action))
      .sort((a, b) => {
        return a.priority - b.priority;
      }) || [];

  const currentTask = newActions[0] || todoActions[0] || null;
  const remainingTasksEstimatedTime = todoActions.reduce((sum, action) => {
    if (action.timeEstimate) {
      return sum + action.timeEstimate;
    }
    return sum;
  }, 0);

  const mainContent = () => {
    if (actions === null) {
      return loading ? (
        <Spinner size="large" />
      ) : (
        <BasicErrorMessage>Error loading actions</BasicErrorMessage>
      );
    }

    return (
      <div
        className={
          "flex flex-col py-8 sm:py-18 px-4 sm:px-12 md:px-18 lg:px-24 xl:px-48 h-full"
        }
      >
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
          <div className="mt-4 px-2 py-2 mx-auto my-auto flex flex-col items-center gap-y-4 h-full justify-center">
            {user?.contractDateSuspended ? (
              <p className="text-center text-zinc-500">
                You will not be given new tasks while your contract is
                suspended.
              </p>
            ) : (
              <>
                <CheckIcon size="large" />
                <p className="text-center text-zinc-500 text-lg lg:text-xl">
                  No tasks to do right now
                </p>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = () => {
    return (
      <div className="px-4 py-4 flex flex-col divide-y *:py-6 *:px-2 divide-zinc-200">
        {todoActions.length + newActions.length > 0 && (
          <div className="flex flex-col gap-y-2">
            <p className="rounded px-5 py-4 bg-white border border-zinc-200">
              {todoActions.length + newActions.length > 0 && (
                <p className="text-zinc-600">
                  <span className="text-green font-medium">
                    {todoActions.length + newActions.length} task
                    {todoActions.length + newActions.length !== 1
                      ? "s"
                      : ""}{" "}
                    left
                  </span>
                  <br />
                  {todoActions.length > 0 &&
                    ` for a total of ${remainingTasksEstimatedTime} minutes`}
                </p>
              )}
            </p>
          </div>
        )}

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
              <Link to="/feed" className="hover:underline text-sm mt-0">
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
    <>
      <div className="hidden md:block">
        <TwoColumnLayout main={mainContent()} sidebar={sidebarContent()} />
      </div>

      <div className="md:hidden">
        <TwoColumnLayout main={mainContent()} />
      </div>
    </>
  );
};

export default HomePage;
