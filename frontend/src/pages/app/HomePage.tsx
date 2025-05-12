import React from "react";
import ActionItemCard, {
  ActionCardAction,
} from "../../components/ActionItemCard";
import SocialPanel from "../../components/SocialPanel";
import ActionPromptCard from "../../components/ActionPromptCard";
import Card, { CardStyle } from "../../components/system/Card";
import TwoColumnSplit from "../../components/system/TwoColumnSplit";

const todoItems = [
  {
    id: 1,
    title: "Boycott Lorem Inc.",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vitae neque leo. Aliquam interdum pretium quam vitae auctor. Phasellus blandit aliquam magna vel congue.",
    category: "Climate",
    actions: [
      ActionCardAction.Discuss,
      ActionCardAction.Details,
      ActionCardAction.Complete,
    ],
  },
  {
    id: 2,
    title: "Call your senator to stop the loreming of ipsums",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusm tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusm tempor incididunt ut labore et dolore magna aliqua.",
    category: "Tech Safety",
    actions: [ActionCardAction.Discuss, ActionCardAction.Details],
  },
];

const HomePage: React.FC = () => {
  return (
    <TwoColumnSplit
      left={
        <div className="flex flex-col py-6 max-w-[600px] gap-y-5 overflow-y-auto">
          <h2 className="text-[#111] text-[14pt]">Actions happening today</h2>
          <ActionPromptCard
            id="1"
            title="Boycotting Lorem Inc."
            description="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vitae neque leo. Aliquam interdum pretium quam vitae auctor. Phasellus blandit aliquam magna vel congue."
            category="Climate"
          />
          {todoItems.map((item) => (
            <ActionItemCard
              key={item.id}
              title={item.title}
              description={item.description}
              category={item.category}
              actions={item.actions}
            />
          ))}
        </div>
      }
      right={
        <div className="flex flex-col gap-y-5 p-6">
          <h2 className="font-bold pb-0">You've committed to:</h2>
          <div className="flex flex-row gap-x-2 items-center cursor-pointer hover:text-blue-700 transition-all duration-300">
            <div className="w-3 h-3 bg-blue-500 rounded-full mb-1"></div>
            <p>Boycott Lorem Inc. for the next week</p>
          </div>
          {/* </Card>
          <Card style={CardStyle.Outline}> */}
          <div className="flex flex-row gap-x-2 items-center cursor-pointer hover:text-blue-700 transition-all duration-300">
            <div className="w-3 h-3 bg-blue-500 rounded-full mb-1"></div>
            <p>
              Find <b>2</b> friends to join lorem ipsum
            </p>
          </div>
          <h2 className="font-bold pt-5">Friend Activity</h2>
          <SocialPanel />
        </div>
      }
    />
  );
};

export default HomePage;
