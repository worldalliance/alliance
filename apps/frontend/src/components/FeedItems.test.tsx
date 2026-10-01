import type { ProfileDto } from "@alliance/shared/client";
import type { ParsedHomeFeedItemDto } from "@alliance/shared/lib/feedHelpers";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import FeedItems from "./FeedItems";

afterEach(cleanup);

const author: ProfileDto = {
  id: 7,
  admin: false,
  profilePicture: null,
  profileDescription: null,
  displayName: "Test Member",
  hasActiveContract: false,
  staff: false,
  ambassador: false,
  anonymous: false,
  isCommunityLeader: false,
};

const date = new Date().toISOString();

const activityItem: ParsedHomeFeedItemDto = {
  type: "activity",
  date,
  activity: {
    id: 11,
    type: "user_completed",
    createdAt: date,
    user: author,
    actionId: 3,
    actionName: "Test Action",
    likes: [],
    likesCount: 0,
    comments: [],
    editableContent: { body: "", attachments: [] },
  },
};

const forumCommentItem: ParsedHomeFeedItemDto = {
  type: "forum_comment",
  date,
  forumComment: {
    postId: 5,
    postTitle: "Test Post",
    likedByMe: false,
    likesCount: 0,
    comment: {
      id: 22,
      parentObjectType: "post",
      parentObjectId: 5,
      deleted: false,
      createdAt: date,
      updatedAt: date,
      parentId: null,
      pinned: false,
      tagId: null,
      author,
      likes: [],
      likesCount: 0,
      editableContent: { body: "", attachments: [] },
    },
  },
};

const renderFeed = (items: ParsedHomeFeedItemDto[]) => {
  const likedActivities: number[] = [];
  const likedComments: number[] = [];
  const { wrapper: QueryWrapper } = queryWrapper();
  render(
    <QueryWrapper>
      <MemoryRouter>
        <FeedItems
          items={items}
          handleLikeActivity={async (id) => likedActivities.push(id)}
          handleLikeForumComment={async (id) => likedComments.push(id)}
        />
      </MemoryRouter>
    </QueryWrapper>,
  );
  return { likedActivities, likedComments };
};

test("likes an activity and a forum comment through their own handlers", async () => {
  const { likedActivities, likedComments } = renderFeed([
    activityItem,
    forumCommentItem,
  ]);

  const [activityLike, commentLike] = screen.getAllByRole("button", {
    name: /like/i,
  });
  await act(async () => {
    fireEvent.click(activityLike);
    fireEvent.click(commentLike);
  });

  expect(likedActivities).toEqual([11]);
  expect(likedComments).toEqual([22]);
});

test("renders nothing for a forum comment item without its comment", () => {
  renderFeed([{ type: "forum_comment", date }]);

  expect(screen.queryByRole("button")).toBeNull();
});
