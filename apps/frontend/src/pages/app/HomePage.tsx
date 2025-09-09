import { ActionDto, UserActionRelation } from "@alliance/shared/client";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import { Link, useNavigate } from "react-router";
import { useAppLoaderData } from "../../applayout";
import ActionActivityFeedItem from "../../components/ActionActivityFeedItem";
import ForumListPost from "../../components/ForumListPost";
import CheckIcon from "../../components/icons/CheckIcon";
import LargeActionCard from "./LargeActionCard";
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
      action.relation === "joined" && action.status === "commitments_reached"
  );

  const currentTask = newActions[0] || todoActions[0] || null;

  const bulletinCard = (
    <Card style={CardStyle.White}>
      <p className="font-medium text-xl text-black mb-2 font-serif">Bulletin</p>
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
    </Card>
  );

  return (
    <div className="flex flex-col w-full h-full items-center bg-white min-h-[calc(100vh-50px)]">
      <div className="flex flex-row px-6 md:gap-x-6 xl:gap-x-10 w-full justify-between px-20">
        <div className="flex-1 flex flex-col py-20 md:py-16 gap-y-5 overflow-y-auto !overflow-visible flex-2 items-center">
          <div className="flex flex-col gap-y-2 border-zinc-200 max-w-3xl">
            <p className="font-serif text-center font-medium text-4xl pt-3 mb-8">
              Your current task
            </p>

            {currentTask && currentTask.relation ? (
              <LargeActionCard
                action={currentTask}
                userRelation={currentTask.relation as "joined" | "none"}
                friendActivities={[]}
                onUpdateActionState={() => navigate(window.location.pathname)}
              />
            ) : (
              <Card style={CardStyle.Transparent}>
                <div className="px-2 py-24 flex flex-col items-center gap-y-4">
                  <CheckIcon size="large" />
                  <p className="text-center text-zinc-500 text-xl">
                    Nothing to do right now!
                  </p>
                </div>
              </Card>
            )}

            {/* {(todoActions.filter((action) => action.id !== currentTask?.id)
              .length > 0 ||
              newActions.filter((action) => action.id !== currentTask?.id)
                .length > 0 ||
              committedActions.length > 0 ||
              commitmentsReachedActions.length > 0) && (
              <>
                <p className="mt-4 font-serif text-3xl">Up next</p>
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
              </>
            )} */}

            {/* <InviteMemberCard /> */}
          </div>
        </div>
        <div className="hidden border-l pl-8 border-zinc-200 md:flex flex-col py-16 gap-y-5 overflow-y-auto items-stretch w-[300px] xl:w-[350px]">
          <div className="flex flex-col divide-y *:py-6 divide-zinc-200">
            <div className="flex">{bulletinCard}</div>
            <div>
              <Card style={CardStyle.White}>
                <p className="font-medium text-xl font-serif text-black">
                  Forum activity
                </p>
                {posts?.length === 0 && (
                  <p className="text-zinc-400 mb-3">No forum activity yet</p>
                )}
                {posts?.length > 0 && (
                  <div className="flex flex-col *:py-3">
                    {posts?.slice(0, 3).map((post) => (
                      <ForumListPost
                        key={post.id}
                        post={post}
                        card={false}
                        showAction={false}
                      />
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div>
              <Card style={CardStyle.White}>
                <div className="flex flex-row justify-between">
                  <p className="font-medium text-xl font-serif text-black mb-3">
                    Friend activity
                  </p>
                  <Link to="/feed" className="text-link text-sm">
                    See all
                  </Link>
                </div>
                <div className="flex flex-col *:py-3 -my-3">
                  {friendActivities.map((activity) => (
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
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
