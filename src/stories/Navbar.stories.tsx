import { StoryObj, Meta } from "@storybook/react";
import Navbar, { NavbarPage } from "../components/Navbar";

const meta = {
  title: "Alliance/Navbar",
  component: Navbar,
  tags: [],
  parameters: {},
  args: {
    currentPage: NavbarPage.Dashboard,
  },
} satisfies Meta<typeof Navbar>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Horizontal: Story = {
  args: {
    format: "horizontal",
  },
};

export const Vertical: Story = {
  args: {
    format: "vertical",
  },
};
