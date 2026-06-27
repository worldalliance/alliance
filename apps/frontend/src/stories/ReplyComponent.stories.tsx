import { CommentDto, CreateEditableContentDto } from "@alliance/shared/client";
import { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import React from "react";
import { CommentsProvider } from "../components/forum/CommentsContext";
import ReplyComponent from "../components/forum/ReplyComponent";
import { testAuthUser } from "./testData";

const makeAuthor = (
  overrides: Partial<CommentDto["author"]> = {},
): CommentDto["author"] => ({
  id: 1,
  displayName: "Jane Smith",
  profilePicture: "",
  admin: false,
  staff: false,
  ambassador: false,
  profileDescription: null,
  hasActiveContract: true,
  isCommunityLeader: false,
  anonymous: false,
  ...overrides,
});

const makeReply = (overrides: Partial<CommentDto> = {}): CommentDto => {
  const reply: CommentDto = {
    id: 100,
    parentObjectType: "post",
    parentObjectId: 1,
    deleted: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    pinned: false,
    author: makeAuthor(),
    children: [],
    likes: [],
    likesCount: 0,
    editableContent: {
      body: "This is a sample reply to the original post. I think we should consider all options before making a decision.",
      attachments: [],
    },
    ...overrides,
  };
  // Let stories that set `likes` render a summary unless they override `likesCount`.
  reply.likesCount = reply.likesCount ?? reply.likes.length;
  return reply;
};

const defaultCtx = {
  user: testAuthUser,
  replyingTo: null as number | null,
  setReplyingTo: fn() as (id: number | null) => void,
  handleSubmitReply: fn() as (
    content: CreateEditableContentDto,
    onSuccess?: () => void,
  ) => Promise<void>,
  handleDeleteReply: fn() as (id: number) => Promise<void>,
  onUpdateReply: fn() as (
    id: number,
    content: CreateEditableContentDto,
  ) => Promise<void>,
  onLikeReply: fn() as (id: number, unlike?: boolean) => Promise<void>,
  onPinReply: fn() as (id: number) => Promise<void>,
  isSubmitting: false,
  newlyAddedReplies: new Set<number>(),
  highlightedReplyId: null as number | null,
  expertIds: [] as number[],
  expertLabel: undefined as string | undefined,
  compact: undefined as boolean | undefined,
};

type CtxOverrides = Partial<typeof defaultCtx>;

const withCtx = (overrides: CtxOverrides = {}) => {
  const WithCtx = (Story: React.ComponentType) => (
    <div className="w-[600px]">
      <CommentsProvider value={{ ...defaultCtx, ...overrides }}>
        <Story />
      </CommentsProvider>
    </div>
  );
  return WithCtx;
};

const meta = {
  title: "Alliance/ReplyComponent",
  component: ReplyComponent,
  tags: ["component"],
  parameters: {
    layout: "centered",
  },
  decorators: [withCtx()],
  args: {
    reply: makeReply(),
    depth: 0,
  },
} satisfies Meta<typeof ReplyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithChildren: Story = {
  args: {
    reply: makeReply({
      children: [
        makeReply({
          id: 101,
          author: makeAuthor({ id: 2, displayName: "Alex Johnson" }),
          editableContent: {
            body: "Great point! I completely agree with your take on this.",
            attachments: [],
          },
          createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        }),
        makeReply({
          id: 102,
          author: makeAuthor({ id: 3, displayName: "Sam Lee" }),
          editableContent: {
            body: "I have a different perspective. Let me explain why I think we should go another direction.",
            attachments: [],
          },
          createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
          likes: [makeAuthor({ id: 2, displayName: "Alex Johnson" })],
        }),
      ],
    }),
  },
};

export const DeeplyNested: Story = {
  args: {
    reply: makeReply({
      children: [
        makeReply({
          id: 101,
          author: makeAuthor({ id: 2, displayName: "Alex Johnson" }),
          editableContent: {
            body: "I think option A is the way to go.",
            attachments: [],
          },
          children: [
            makeReply({
              id: 102,
              author: makeAuthor({ id: 3, displayName: "Sam Lee" }),
              editableContent: {
                body: "Why option A over option B though?",
                attachments: [],
              },
              children: [
                makeReply({
                  id: 103,
                  author: makeAuthor({
                    id: 2,
                    displayName: "Alex Johnson",
                  }),
                  editableContent: {
                    body: "Option A has better long-term scalability. Here are the reasons...",
                    attachments: [],
                  },
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  },
};

export const Pinned: Story = {
  args: {
    reply: makeReply({ pinned: true }),
  },
};

export const Deleted: Story = {
  args: {
    reply: makeReply({
      deleted: true,
      children: [
        makeReply({
          id: 101,
          author: makeAuthor({ id: 2, displayName: "Alex Johnson" }),
          editableContent: {
            body: "This child reply is still visible even though the parent was deleted.",
            attachments: [],
          },
        }),
      ],
    }),
  },
};

export const WithLikes: Story = {
  args: {
    reply: makeReply({
      likes: [
        makeAuthor({ id: 2, displayName: "Alex Johnson" }),
        makeAuthor({ id: 3, displayName: "Sam Lee" }),
        makeAuthor({ id: 4, displayName: "Morgan Chen" }),
      ],
    }),
  },
};

export const LikedByCurrentUser: Story = {
  args: {
    reply: makeReply({
      likes: [
        makeAuthor({ id: 1, displayName: "Jane Smith" }),
        makeAuthor({ id: 2, displayName: "Alex Johnson" }),
      ],
    }),
  },
};

export const NewlyAdded: Story = {
  decorators: [withCtx({ newlyAddedReplies: new Set<number>([200]) })],
  args: {
    reply: makeReply({ id: 200 }),
  },
};

export const Highlighted: Story = {
  decorators: [withCtx({ highlightedReplyId: 300 })],
  args: {
    reply: makeReply({ id: 300 }),
  },
};

export const ReplyingTo: Story = {
  decorators: [withCtx({ replyingTo: 400 })],
  args: {
    reply: makeReply({ id: 400 }),
  },
};

export const Compact: Story = {
  decorators: [withCtx({ compact: true })],
  args: {
    reply: makeReply({
      children: [
        makeReply({
          id: 101,
          author: makeAuthor({ id: 2, displayName: "Alex Johnson" }),
          editableContent: {
            body: "A compact child reply.",
            attachments: [],
          },
        }),
      ],
    }),
  },
};

export const StaffAuthor: Story = {
  args: {
    reply: makeReply({
      author: makeAuthor({ staff: true, displayName: "Staff Member" }),
    }),
  },
};

export const ExpertAuthor: Story = {
  decorators: [withCtx({ expertIds: [5], expertLabel: "Subject Expert" })],
  args: {
    reply: makeReply({
      author: makeAuthor({ id: 5, displayName: "Expert User" }),
    }),
  },
};

export const LoggedOut: Story = {
  decorators: [withCtx({ user: undefined })],
};

export const FullThread: Story = {
  args: {
    reply: makeReply({
      pinned: true,
      likes: [makeAuthor({ id: 2, displayName: "Alex Johnson" })],
      children: [
        makeReply({
          id: 101,
          author: makeAuthor({ id: 2, displayName: "Alex Johnson" }),
          editableContent: {
            body: "This is really insightful, thanks for sharing!",
            attachments: [],
          },
          likes: [
            makeAuthor({ id: 1, displayName: "Jane Smith" }),
            makeAuthor({ id: 3, displayName: "Sam Lee" }),
          ],
          createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
        }),
        makeReply({
          id: 102,
          author: makeAuthor({
            id: 3,
            displayName: "Sam Lee",
            staff: true,
          }),
          editableContent: {
            body: "As a staff member, I can confirm this approach has been discussed internally.",
            attachments: [],
          },
          createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          children: [
            makeReply({
              id: 103,
              author: makeAuthor({ id: 4, displayName: "Morgan Chen" }),
              editableContent: {
                body: "That's great to hear! When can we expect an update?",
                attachments: [],
              },
              createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
            }),
          ],
        }),
        makeReply({
          id: 104,
          deleted: true,
        }),
      ],
    }),
  },
};
