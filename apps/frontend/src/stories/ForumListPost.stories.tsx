import { PostDto } from "@alliance/shared/client";
import List from "@alliance/sharedweb/ui/List";
import { Meta, StoryObj } from "@storybook/react";
import ForumListPost from "../components/ForumListPost";

const samplePost: PostDto = {
  id: 1,
  title: "How should the alliance handle forum post styling?",
  editableContent: {
    body: "We need to discuss how we should handle forum post styling. I think we should use the same styling as the website.",
    attachments: [],
  },
  author: {
    displayName: "John Doe",
    id: 0,
    profilePicture: "",
    admin: false,
    staff: false,
    ambassador: false,
    profileDescription: null,
    hasActiveContract: false,
    isCommunityLeader: false,
    anonymous: false,
  },
  authorId: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  pinned: false,
  deleted: false,
  qaMode: false,
  expertIds: [],
  authorIds: [],
  notifyForReplies: false,
  showClusterTags: false,
};

export const ManyPosts: Story = {
  render: () => {
    return (
      <List className="min-w-[800px]">
        {Array.from({ length: 10 }).map((_, index) => (
          <ForumListPost key={index} post={samplePost} />
        ))}
      </List>
    );
  },
};

const meta = {
  title: "Alliance/ForumListPost",
  component: ForumListPost,
  tags: ["component"],
  parameters: {
    layout: "centered",
  },
  args: {
    post: samplePost,
  },
} satisfies Meta<typeof ForumListPost>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
