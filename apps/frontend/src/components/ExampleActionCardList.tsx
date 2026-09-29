import React from "react";
import ExampleActionCard from "./ExampleActionCard";

interface ExampleActionCardListProps {
  bgColor?: "grey" | "white";
  dropdown?: boolean;
}

const ExampleActionCardList: React.FC<ExampleActionCardListProps> = ({
  bgColor = "grey",
  dropdown = false,
}: ExampleActionCardListProps) => {
  const exampleActions = [
    {
      name: "Plan your contribution to a collective donation to Helen Keller International",
      description:
        "Members found ways to earn or save money to donate more than $3,000 collectively to Helen Keller International, an effective nonprofit addressing global malnutrition.",
      link: "/actions/84",
    },
    {
      name: "Discuss the repeal of the endangerment finding with current and former U.S. EPA employees",
      description:
        "Members discussed the repeal of the EPA's endangerment finding, as well as the current state of the EPA, with current and former EPA employees.",
      link: "/actions/76",
    },
    {
      name: "Help inform public comments on U.S. federal AI policy",
      description:
        "Members were asked questions about personal experiences and beliefs related to three federal dockets on AI policy. Then, the office posted three official comments summarizing members' answers.",
      link: "/actions/75",
    },

    {
      name: "Sign a letter requesting news coverage of a bring-your-own-cup cafe coalition",
      description: (
        <span>
          The office asked several cafes to adopt and advertise a
          bring-your-own-cup policy, promising that members would help them
          attain media coverage. Then, members signed a letter to journalists
          requesting a feature. Finally, a journalist{" "}
          <a
            href="https://www.baristamagazine.com/washington-cafes-are-uniting-to-combat-disposable-cup-waste-and-they-want-you-to-join-them/"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            wrote an article about the cafes
          </a>
          .
        </span>
      ),
      link: "/actions/14",
    },
  ];

  return (
    <div className="flex flex-col rounded gap-y-2">
      {exampleActions.map((action) => (
        <ExampleActionCard
          bgColor={bgColor}
          key={action.name}
          name={action.name}
          description={action.description}
          link={action.link}
          dropdown={dropdown}
        />
      ))}
    </div>
  );
};

export default ExampleActionCardList;
