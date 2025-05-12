import { Meta, StoryObj } from "@storybook/react";
import Card, { CardStyle } from "../components/system/Card";
import testImage from "./test_image.jpg";

export const AllCards: Story = {
  render: () => {
    return (
      <div className="flex flex-col gap-4 min-w-[300px]">
        {Object.values(CardStyle).map((style) => (
          <Card
            key={style}
            style={style}
            bgImage={style === CardStyle.Image ? testImage : undefined}
          >
            {style}
          </Card>
        ))}
      </div>
    );
  },
};

const meta = {
  title: "Alliance/Card",
  component: Card,
  tags: ["component"],
  parameters: {
    layout: "centered",
  },
  args: {
    children: "Hello",
    style: CardStyle.White,
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
