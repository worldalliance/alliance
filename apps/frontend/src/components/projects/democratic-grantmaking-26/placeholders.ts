export interface ProjectPerson {
  name: string;
  role: string;
  href: string;
  imageSrc: string;
}

export const FEATURED_PEOPLE: ProjectPerson[] = [
  {
    name: "Dustin Palmer",
    imageSrc: "/assets/democratic-grantmaking-26/dustin-palmer.jpg",
    role: "Expert",
    href: "https://www.linkedin.com/in/dustin-palmer/",
  },
  {
    name: "Healy Hamilton",
    imageSrc: "/assets/democratic-grantmaking-26/healy-hamilton.jpg",
    role: "Expert",
    href: "https://www.linkedin.com/in/healy-hamilton-a1a20942/",
  },
  {
    name: "Jan Maly",
    imageSrc: "/assets/democratic-grantmaking-26/jan-maly.jpg",
    role: "Research Advisor",
    href: "https://janmaly.de/",
  },
];

export const ABOUT_SECTIONS = [
  {
    heading: "What this is",
    body: "This is an Alliance project. Outside funders have put up $100,000 for a nonprofit, and Alliance members help decide which one gets it. Join the Alliance to take part.",
  },
  {
    heading: "How it works",
    body: "Once the Alliance reaches 1,000 members, you can nominate a nonprofit, and experts will analyze how each nominee would use the $100,000. Using these analyses, you'll then vote to narrow the field. Our expert panel picks the winner from top choices, and the full $100,000 goes to that nonprofit.",
  },
  {
    heading: "Why we're doing this",
    body: "Charitable funding is usually decided by a few people, and it's difficult for smaller nonprofits to receive funding. We want to test a new democratic process that pairs what members care about with what experts know. After the project, we'll work with [Jan Maly](https://janmaly.de/) of [WU Vienna](https://www.wu.ac.at/en/dpkm) to publish research on the results.",
  },
];
