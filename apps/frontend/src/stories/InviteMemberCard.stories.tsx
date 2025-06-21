import { Meta, StoryObj } from "@storybook/react";
import InviteMemberCard from "../components/InviteMemberCard";

const meta = {
  title: "Alliance/InviteMemberCard",
  component: InviteMemberCard,
  tags: ["component"],
  parameters: {
    layout: "centered",
  },
  args: {},
} satisfies Meta<typeof InviteMemberCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
