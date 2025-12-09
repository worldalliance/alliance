import React from "react";
import ExampleActionCard from "./ExampleActionCard";

const ExampleActionCardList: React.FC = () => {
  const exampleActions = [
    {
      name: "Participate in an experiment to measure awareness of AI data use practices",
      description:
        "Members were asked about their AI privacy preferences. The office will use the results to plan a follow-up awareness campaign in favor of opt-in, rather than opt-out, data use practices.",
    },
    {
      name: "Report a pothole in your community",
      description:
        "Members found and reported a pothole to their local government, most of which were repaired within a week.",
    },
    {
      name: "Approve proposals for how to spend $1,000",
      description:
        "Members sent in and voted on proposals for how to spend $1,000 provided by a one-time donor. The $1,000 was ultimately split between Cool Earth and GiveDirectly.",
    },
    {
      name: "Answer questions about nonprofit website copy and design",
      description:
        "Members provided feedback on the copy and design of three nonprofit websites. The office sent the results to the nonprofits to help them increase their donation conversion rates.",
    },
  ];

  return (
    <div className="flex flex-col divide-y divide-zinc-200 border border-zinc-200 rounded">
      {exampleActions.map((action) => (
        <ExampleActionCard
          key={action.name}
          name={action.name}
          description={action.description}
        />
      ))}
    </div>
  );
};

export default ExampleActionCardList;
