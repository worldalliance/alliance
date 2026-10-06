export interface ProjectPerson {
  name: string;
  role: string;
  href: string;
  imageSrc: string;
}

export const FEATURED_PEOPLE: ProjectPerson[] = [
  {
    name: "Advised by Jan Maly",
    imageSrc: "/assets/democratic-grantmaking-26/jan-maly.jpg",
    role: "Expert on group decision-making, WU Wien",
    href: "https://janmaly.de/",
  },
  // {
  //   name: "Healy Hamilton",
  //   imageSrc: "/assets/democratic-grantmaking-26/healy-hamilton.jpg",
  //   role: "Expert Panel",
  //   href: "https://www.linkedin.com/in/healy-hamilton-a1a20942/",
  // },
  // {
  //   name: "Dustin Palmer",
  //   imageSrc: "/assets/democratic-grantmaking-26/dustin-palmer.jpg",
  //   role: "Expert Panel",
  //   href: "https://www.linkedin.com/in/dustin-palmer/",
  // },
];

export const ABOUT_SECTIONS = [
  {
    heading: "What is this?",
    body: "This is an upcoming Alliance project. External funders have committed $100,000 to a pool that Alliance members and an expert panel will decide how to donate.",
  },
  {
    heading: "How will this work?",
    body: `1,000 Alliance members and an expert panel will decide how to donate the $100,000. This will happen in a four-step process:

1. Alliance members nominate nonprofits.
2. Experts analyze how each nominee would use the $100,000.
3. Alliance members use expert analyses to vote on nonprofits.
4. The expert panel picks the final winner from members' top choices.`,
  },
  {
    heading: "Why are we doing this?",
    body: "We're learning how to effectively combine member values and expert analysis to donate money. This process could one day become a transparent giving service for large-scale donors. After the project, we'll work with [Jan Maly](https://janmaly.de/) of [WU Vienna](https://www.wu.ac.at/en/dpkm) to publish our findings.",
  },
  {
    heading: "How do I participate?",
    body: "Join the waitlist on this page. We'll reach out soon with an invitation to the Alliance. Once the Alliance reaches 1,000 members, this project will begin.",
  },
];
