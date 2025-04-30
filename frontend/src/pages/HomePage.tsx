import React from "react";
import ActionItemCard, { ActionCardAction } from "../components/ActionItemCard";
import SocialPanel from "../components/SocialPanel";
import ActionPromptCard from "../components/ActionPromptCard";
import Card, { CardStyle } from "../components/system/Card";

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
    <div className="flex flex-row min-h-screen h-fitcontent flex-nowrap bg-stone-50">
      <div className="flex flex-row py-12 justify-center w-full gap-x-6">
        <div className="flex flex-col border-r border-gray-300 pr-6 max-w-[600px] gap-y-5 overflow-y-auto">
          <h2 className="text-[#111] text-[14pt]">
            Welcome back! Here's what you can help with right now
          </h2>
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
          <h2 className="text-[#111] text-[14pt] font-extrabold">
            Action History
          </h2>
          <Card style={CardStyle.Outline}>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </p>
          </Card>
          <Card style={CardStyle.Outline}>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </p>
          </Card>
        </div>
        <div className="flex flex-col gap-y-5 w-[320px]">
          <Card style={CardStyle.White}>
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
          </Card>
          <h2 className="font-bold pt-5">Friend Activity</h2>
          <SocialPanel />
        </div>
      </div>
    </div>
  );
};

export default HomePage;
