import useActivities, { ActivityList } from "./useActivities";

export enum FeedMode {
  Friends = "friends",
  Everyone = "everyone",
}

export const FEED_EMPTY_MESSAGE: Record<FeedMode, string> = {
  [FeedMode.Friends]: "No friend activity yet",
  [FeedMode.Everyone]: "No activity yet",
};

const FEED_PAGE_SIZE = 30;

const useActivityFeeds = (): Record<
  FeedMode,
  ReturnType<typeof useActivities>
> => {
  const friends = useActivities({
    list: ActivityList.Friends,
    comments: true,
    limit: FEED_PAGE_SIZE,
  });
  const everyone = useActivities({
    list: ActivityList.Global,
    comments: true,
    limit: FEED_PAGE_SIZE,
  });
  return { [FeedMode.Friends]: friends, [FeedMode.Everyone]: everyone };
};

export default useActivityFeeds;
