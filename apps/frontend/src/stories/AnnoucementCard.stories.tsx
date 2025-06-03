import { Meta, StoryObj } from "@storybook/react";
import AnnouncementCard from "../components/AnnouncementCard";

const meta = {
  title: "Alliance/AnnouncementCard",
  component: AnnouncementCard,
  tags: ["component"],
  parameters: {
    layout: "centered",
  },
  args: {
    data: {
      id: 1,
      title: "Alliance beta site launched!",
      bodyText:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
      headerImage: null,
      dateCreated: "2025-01-01",
    },
  },
} satisfies Meta<typeof AnnouncementCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unread: Story = {
  args: {
    unread: true,
  },
};

export const Read: Story = {
  args: {
    unread: false,
  },
};
