import React from "react";
import Navbar, { NavbarPage } from "../components/Navbar";
import ActionItemCard, { ActionCardAction } from "../components/ActionItemCard";
import ActivityPanel from "../components/ActivityPanel";

const todoItems = [
  {
    id: 1,
    title: "Boycott Lorem Inc.",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vitae neque leo. Aliquam interdum pretium quam vitae auctor. Phasellus blandit aliquam magna vel congue.",
    category: "Climate",
    actions: [ActionCardAction.Discuss, ActionCardAction.Details],
  },
  {
    id: 2,
    title: "Call your senator to stop the loreming of ipsums",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusm tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusm tempor incididunt ut labore et dolore magna aliqua.",
    category: "Climate",
    actions: [ActionCardAction.Discuss, ActionCardAction.Details],
  },
];

const HomePage: React.FC = () => {
  return (
    <div className="flex flex-row min-h-screen h-fitcontent flex-nowrap bg-stone-50">
      <Navbar currentPage={NavbarPage.ActionItems} format="horizontal" />
      <div className="flex flex-row py-[80px] justify-center w-full gap-x-[20px]">
        <div className="flex flex-col border-r border-gray-300 pr-5">
          <h1 className="text-[#111] font-avenir text-[14pt] font-extrabold mb-5 my-0">
            You've committed to
          </h1>
          {todoItems.map((item) => (
            <ActionItemCard
              key={item.id}
              title={item.title}
              description={item.description}
              category={item.category}
              actions={item.actions}
            />
          ))}
          <h1 className="text-[#111] font-avenir text-[14pt] font-extrabold my-5">
            Action History
          </h1>
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
        <div className="flex flex-col">
          <h1 className="text-[#111] font-avenir text-[14pt] font-extrabold mb-5 my-0">
            Updates
          </h1>
          <ActivityPanel />
        </div>
      </div>
    </div>
  );
};

export default HomePage;
