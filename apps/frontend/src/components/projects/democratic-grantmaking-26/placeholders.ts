export interface ProjectPerson {
  name: string;
  role: string;
  href: string;
  imageSrc: string;
}

export const FEATURED_PEOPLE: ProjectPerson[] = [
  {
    name: "Jan Maly",
    imageSrc: "/assets/democratic-grantmaking-26/jan-maly.jpg",
    role: "Online Decision-Making, WU Wien",
    href: "https://janmaly.de/",
  },
  {
    name: "Healy Hamilton",
    imageSrc: "/assets/democratic-grantmaking-26/healy-hamilton.jpg",
    role: "Chief Scientist, Sustainable Forestry Initiative",
    href: "https://www.linkedin.com/in/healy-hamilton-a1a20942/",
  },
  {
    name: "Dustin Palmer",
    imageSrc: "/assets/democratic-grantmaking-26/dustin-palmer.jpg",
    role: "Executive Director, US Programs at GiveDirectly",
    href: "https://www.linkedin.com/in/dustin-palmer/",
  },
  {
    name: "Brendan Nyhan",
    imageSrc: "/assets/democratic-grantmaking-26/brendan.jpeg",
    role: "Professor of Government, Dartmouth College",
    href: "https://govt.dartmouth.edu/people/brendan-nyhan",
  },
  {
    name: "Andrew Cantino",
    imageSrc: "/assets/democratic-grantmaking-26/andrew.jpg",
    role: "Program Advisor, Renaissance Philanthropy",
    href: "https://www.linkedin.com/in/cantino/",
  },
  {
    name: "Bastian Herre",
    imageSrc: "/assets/democratic-grantmaking-26/bastian.jpeg",
    role: "Politics & Society Lead, Our World in Data",
    href: "https://www.linkedin.com/in/bastian-herre-33264623/",
  },
  {
    name: "Eli Sepulveda",
    imageSrc: "/assets/democratic-grantmaking-26/eli.jpeg",
    role: "Global Catastrophic Risks, Founders Pledge",
    href: "https://www.linkedin.com/in/sepllveda/",
  },
  {
    name: "Kyle Gracey",
    imageSrc: "/assets/democratic-grantmaking-26/kyle-gracey.png",
    role: "AI Strategy Program Leader, Rethink Priorities",
    href: "https://www.linkedin.com/in/kylegracey/",
  },
];

export const ABOUT_SECTIONS = [
  {
    heading: "What is this?",
    body: "This is a project that will launch when the Alliance reaches 1,000 members. Outside funders have put up $100,000 for a nonprofit, and Alliance members will help decide which nonprofit will receive the money. ",
  },
  {
    heading: "How do I participate?",
    body: "Join the waitlist on this page. We'll reach out soon with an invitation to the Alliance. Once the Alliance reaches 1,000 members, this project will begin.",
  },
  {
    heading: "How will this work?",
    body: `1,000 Alliance members and an expert panel will decide how to donate the $100,000. This will happen in a four-step process:

1. Alliance members nominate nonprofits.
2. Experts analyze how each nonprofit would use the $100,000.
3. Alliance members use expert analyses to vote on nonprofits.
4. Experts select the final recipient from members' top choices.`,
  },
  {
    heading: "Why are we doing this?",
    body: "We're learning how to effectively combine member values and expert analysis to donate money. This process could one day become a transparent giving service for large-scale donors. After the project, we'll work with [Jan Maly](https://janmaly.de/) of [WU Vienna](https://www.wu.ac.at/en/dpkm) to publish our findings.",
  },
];
