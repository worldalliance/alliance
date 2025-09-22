import { ActionDto, UserActionRelation } from "@alliance/shared/client";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import CheckIcon from "@alliance/shared/ui/icons/CheckIcon";
import { Link, useNavigate } from "react-router";
import { useAppLoaderData } from "../../applayout";
import ActionActivityFeedItem from "../../components/ActionActivityFeedItem";
import ForumListPost from "../../components/ForumListPost";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import LargeActionCard from "./LargeActionCard";
import SmallActionCard from "./SmallActionCard";
import useActivities, { ActivityList } from "./useActivities";

export function canCompleteAction(
  action: ActionDto,
  relation?: UserActionRelation
) {
  return (
    action.status === "member_action" &&
    (relation === "joined" ||
      (action.commitmentless && relation !== "completed")) &&
    relation !== "declined"
  );
}

const HomePage = () => {
  const navigate = useNavigate();
  const { actions, posts, activities } = useAppLoaderData();

  const { activities: friendActivities, handleLikeActivity } = useActivities({
    list: ActivityList.Friends,
  });

  const todoActions = actions.filter((action) =>
    canCompleteAction(action, action.relation)
  );

  const newActions = actions.filter(
    (action) =>
      action.relation === "none" && action.status === "gathering_commitments"
  );

  const committedActions = actions.filter(
    (action) =>
      action.relation === "joined" && action.status === "gathering_commitments"
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

  useWhiteBackground();

  const bulletinCard = (
    <div>
      <p className="font-semibold text-xl text-black mb-2 font-serif">
        Bulletin
      </p>
      <p className="text-black mb-2">
        Right now, we are focused on organizational improvement and small-scale
        experiments that test collective action strategies.
      </p>
      <p className="text-black">
        Learn more about our current{" "}
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
        <div className="flex flex-col gap-y-5 overflow-y-auto !overflow-visible flex-1 items-center px-5">
          <div className="flex flex-col gap-y-2 border-zinc-200 w-full sm:w-xl lg:w-2xl">
            <div
              className={
                "md:min-h-[calc(100vh-var(--nav-height))] pb-12 flex flex-col items-center"
              }
            >
              <div className="mb-8">
                <p className="font-serif text-center font-semibold text-3xl mt-12 sm:mt-16 lg:mt-28">
                  Current task
                </p>
                {todoActions.length + newActions.length > 0 && (
                  <p className="mt-1 text-zinc-500 text-center px-4">
                    {todoActions.length + newActions.length} task
                    {todoActions.length + newActions.length !== 1
                      ? "s"
                      : ""}{" "}
                    left
                    {todoActions.length > 0 &&
                      ` for a total of ${remainingTasksEstimatedTime} minutes`}
                  </p>
                )}
              </div>
              {currentTask && currentTask.relation ? (
                <LargeActionCard
                  action={currentTask}
                  userRelation={currentTask.relation as "joined" | "none"}
                  friendActivities={[]}
                  onUpdateActionState={() => navigate(window.location.pathname)}
                />
              ) : (
                <Card style={CardStyle.Transparent} className="w-full">
                  <div className="px-2 py-36 flex flex-col items-center gap-y-4">
                    <CheckIcon size="large" />
                    <p className="text-center text-zinc-500 text-lg">
                      Nothing to do right now!
                    </p>
                  </div>
                </Card>
              )}
            </div>

            {(todoActions.filter((action) => action.id !== currentTask?.id)
              .length > 0 ||
              newActions.filter((action) => action.id !== currentTask?.id)
                .length > 0 ||
              committedActions.length > 0 ||
              commitmentsReachedActions.length > 0) && (
              <div className="pb-54 flex flex-col items-center ">
                <p className="mb-8 font-serif font-semibold text-3xl text-center">
                  Up next
                </p>
                <div className="flex flex-col gap-y-2 w-full">
                  {todoActions
                    .filter((action) => action.id !== currentTask?.id)
                    .map((action) => (
                      <SmallActionCard
                        key={action.id}
                        {...action}
                        showDescription={true}
                        friendActivities={friendActivities.filter(
                          (activity) =>
                            activity.actionId === action.id &&
                            activity.type === "user_completed"
                        )}
                        joinedCount={action.usersCompleted}
                        neededCount={action.usersJoined}
                      />
                    ))}
                  {newActions
                    .filter((action) => action.id !== currentTask?.id)
                    .map((action) => (
                      <SmallActionCard
                        key={action.id}
                        {...action}
                        showDescription={true}
                      />
                    ))}
                  {committedActions.map((action) => (
                    <SmallActionCard
                      key={action.id}
                      {...action}
                      joinedCount={action.usersJoined}
                      neededCount={action.commitmentThreshold}
                      friendActivities={friendActivities.filter(
                        (activity) =>
                          activity.actionId === action.id &&
                          activity.type === "user_joined"
                      )}
                      showDescription={false}
                      activity={activities?.get(action.id)?.join ?? undefined} //TODO: type this so that it always exists
                    />
                  ))}
                  {commitmentsReachedActions.map((action) => (
                    <SmallActionCard
                      key={action.id}
                      {...action}
                      joinedCount={action.usersJoined}
                      neededCount={action.commitmentThreshold}
                      friendActivities={friendActivities.filter(
                        (activity) =>
                          activity.actionId === action.id &&
                          activity.type === "user_joined"
                      )}
                      showDescription={false}
                      activity={activities?.get(action.id)?.join ?? undefined} //TODO: type this so that it always exists
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div
          className={`hidden border-l pl-6 pr-10 border-zinc-200 md:flex flex-col py-2 gap-y-5 sticky top-[var(--nav-height)] min-h-[calc(100vh-var(--nav-height))] h-fit items-stretch w-[380px]`}
        >
          <div className="flex flex-col divide-y *:py-5 *:px-2 divide-zinc-200">
            <div className="flex">{bulletinCard}</div>
            <div>
              <p className="font-semibold text-xl font-serif text-black">
                Forum activity
              </p>
              {posts?.length === 0 && (
                <p className="text-zinc-400 mt-3">No activity yet.</p>
              )}
              {posts?.length > 0 && (
                <div className="flex flex-col *:py-3 -mb-3">
                  {posts?.slice(0, 2).map((post) => (
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
            <div>
              <div className="flex flex-row justify-between">
                <p className="font-semibold text-xl font-serif text-black mb-3">
                  Friend activity
                </p>
                {friendActivities.length > 0 && (
                  <Link to="/feed" className="text-link text-sm">
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
                {friendActivities.slice(0, 3).map((activity) => (
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
