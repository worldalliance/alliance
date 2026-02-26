import React from "react";
import ExampleActionCard from "./ExampleActionCard";

const ExampleActionCardList: React.FC = () => {
  const exampleActions = [
    {
      name: "Discuss the repeal of the endangerment finding with current and former U.S. EPA employees",
      description:
        "Members discussed the repeal of the EPA's endangerment finding, as well as the current state of the EPA, with current and former EPA employees.",
      purpose:
        "Members and government employees had the opportunity to learn from each other directly, rather than through media reports or other indirect channels.",
    },
    {
      name: "Help inform public comments on U.S. federal AI policy",
      description:
        "Members were asked questions about personal experiences and beliefs related to three federal dockets on AI policy. After the members took action, the office wrote and posted three official comments summarizing members' answers.",
      purpose:
        "Our goal was to help agencies to incorporate citizens' perspectives into a decision-making process that usually only considers experts and industry representatives.",
    },
    {
      name: "Participate in an experiment to measure awareness of AI data use practices",
      description:
        "Members were asked about their AI privacy preferences. The office will use the results to plan a follow-up awareness campaign in favor of opt-in, rather than opt-out, data use practices.",
      purpose:
        "We will learn if surfacing members' preferences can help us generate awareness of important issues.",
      imgSrc: "https://worldalliance.org/api/images/1765910145202.webp",
      imgAlt: "A survey flyer that a member displayed in their community",
    },
    {
      name: "Report a pothole in your community",
      description:
        "Members found and reported a pothole to their local government, most of which were repaired within a week.",
      purpose:
        "Members learned about one way that local governments can respond quickly to citizen concerns. We reported 19 potholes and 1 broken wall in total.",
      imgSrc: "https://worldalliance.org/api/images/1765911493684.webp",
      imgAlt: "A pothole reported by a member",
    },
    {
      name: "Sign a letter requesting news coverage of a bring-your-own-cup cafe coalition",
      description: (
        <span>
          The office asked several cafes to adopt and advertise a
          bring-your-own-cup policy, promising that members would help them
          attain media coverage. After the cafes took action, members signed a
          letter to journalists requesting a feature. Finally, a journalist{" "}
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
      purpose:
        "We learned that offering to help businesses attain media coverage can encourage policy changes. The policy change itself will likely reduce a small amount of waste.",
      imgSrc: "https://worldalliance.org/api/images/1765912025673.webp",
      imgAlt: "A cafe team took this photo for the article",
    },
  ];

  return (
    <div className="flex flex-col rounded gap-y-6">
      {exampleActions.map((action) => (
        <ExampleActionCard
          key={action.name}
          name={action.name}
          description={action.description}
          purpose={action.purpose}
          imgSrc={action.imgSrc}
          imgAlt={action.imgAlt}
        />
      ))}
    </div>
  );
};

export default ExampleActionCardList;
