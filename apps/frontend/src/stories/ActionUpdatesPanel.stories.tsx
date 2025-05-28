import { Meta, StoryObj } from "@storybook/react";
import ActionUpdatesPanel from "../components/ActionUpdatesPanel";

const meta = {
  title: "Alliance/ActionUpdatesPanel",
  component: ActionUpdatesPanel,
  tags: ["component"],
  parameters: {
    layout: "centered",
  },
  args: {
    action: {
      id: 1,
      name: "Boycott Acme Inc.",
      description:
        "Acme. corp has been found to lorem over 160,00 ipsums every single year, causing untold devastation in the placeholder text industry.",
      category: "Climate Change",
      whyJoin: "",
      image: "",
      timeEstimate: "",
      status: "Active",
      usersJoined: 0,
      myRelation: {
        status: "declined",
        dateCommitted: "",
        dateCompleted: "",
        deadline: "",
      },
    },
  },
} satisfies Meta<typeof ActionUpdatesPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
