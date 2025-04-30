import { Meta, StoryObj } from "@storybook/react";
import AnnouncementCard from "../components/AnnoucementCard";

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
      title: "Boycott Acme Inc.",
      bodyText:
        "Acme. corp has been found to lorem over 160,00 ipsums every single year, causing untold devastation in the placeholder text industry.",
      headerImage: null,
    },
    unread: false,
  },
} satisfies Meta<typeof AnnouncementCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
