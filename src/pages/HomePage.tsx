import React from "react";
import Navbar, { NavbarPage } from "../components/Navbar";
import TodoCard from "../components/TodoCard";

const HomePage: React.FC = () => {
  // Sample todo items data
  const todoItems = [
    {
      id: 1,
      title: "Find a suffering shrimp baby",
      description:
        "Cradle it in your arms and sing it a lullaby. It will be okay. It will be okay. It will be okay.",
      category: "Climate",
    },
    {
      id: 2,
      title: "Make a shrimp soup",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusm tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusm tempor incididunt ut labore et dolore magna aliqua.",
      category: "Climate",
    },
    {
      id: 3,
      title: "Make a shrimp soup",
      description:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
      category: "Climate",
    },
  ];

  return (
    <div className="flex flex-row min-h-screen">
      <Navbar currentPage={NavbarPage.ActionItems} />
      <div className="w-[calc(100%-200px)] items-start justify-center p-[30px]">
        <h1 className="text-[#111] font-font text-[15pt] font-extrabold mb-5">
          Your Actions
        </h1>
        {todoItems.map((item) => (
          <TodoCard
            key={item.id}
            title={item.title}
            description={item.description}
            category={item.category}
          />
        ))}
      </div>
    </div>
  );
};

export default HomePage;
