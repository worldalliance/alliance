import { Meta, StoryObj } from "@storybook/react";
import ForumListPost from "../components/ForumListPost";
import { PostDto } from "../client";

const samplePost: PostDto = {
  id: 1,
  title: "How should the alliance handle forum post styling?",
  content:
    "We need to discuss how we should handle forum post styling. I think we should use the same styling as the website.",
  author: { name: "John Doe", email: "john.doe@example.com" },
  action: {
    id: 1,
    name: "Nestle Rainforest Purchase",
    category: "Climate",
    whyJoin: "",
    image: "",
    description: "",
    status: "Active",
    createdAt: "",
    updatedAt: "",
    usersJoined: 0,
  },
  replies: [],
  authorId: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const AllCards: Story = {
  render: () => {
    return (
      <div className="flex flex-col min-w-[800px]">
        {Array.from({ length: 10 }).map((_, index) => (
          <ForumListPost
            key={index}
            post={samplePost}
            handleViewPost={() => {}}
          />
        ))}
      </div>
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
    handleViewPost: () => {},
  },
} satisfies Meta<typeof ForumListPost>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
