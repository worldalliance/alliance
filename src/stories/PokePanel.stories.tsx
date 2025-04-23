import { Meta, StoryObj } from "@storybook/react";
import PokePanel from "../components/PokePanel";

const meta = {
  title: "Alliance/PokePanel",
  component: PokePanel,
  tags: ["component"],
  parameters: {
    layout: "centered",
  },
  args: {},
} satisfies Meta<typeof PokePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
