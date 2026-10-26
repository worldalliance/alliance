export interface ProjectPerson {
  name: string;
  role: string;
  href?: string;
  imageSrc: string;
}

export const FEATURED_PEOPLE: ProjectPerson[] = [
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
    name: "Samuel Dupret",
    imageSrc: "/assets/democratic-grantmaking-26/samuel-dupret.jpg",
    role: "Research manager, Happier Lives Institute",
    href: "https://www.samueldupret.com/",
  },
  {
    name: "Jan Maly",
    imageSrc: "/assets/democratic-grantmaking-26/jan-maly.jpg",
    role: "Online Decision-Making, WU Wien",
    href: "https://janmaly.de/",
  },
  {
    name: "Kyle Gracey",
    imageSrc: "/assets/democratic-grantmaking-26/kyle-gracey.png",
    role: "AI Strategy Program Leader, Rethink Priorities",
    href: "https://www.linkedin.com/in/kylegracey/",
  },
  {
    name: "Luke Kemp",
    imageSrc: "/assets/democratic-grantmaking-26/luke-kemp.jpg",
    role: "Research Affiliate, Centre for the Study of Existential Risk at University of Cambridge",
    href: "https://www.linkedin.com/in/luke-kemp-689b8271/",
  },
  {
    name: "Lindsey McDougle",
    imageSrc: "/assets/democratic-grantmaking-26/lindsey-mcdougle.jpg",
    role: "Director, Rutgers Center for Nonprofit Leadership & Development; President-Elect, ARNOVA",
    href: "https://spaa.newark.rutgers.edu/lindsey-mcdougle",
  },
  {
    name: "Megan Tompkins-Stange",
    imageSrc: "/assets/democratic-grantmaking-26/megan.jpg",
    role: "Associate Professor of Public Policy, University of Michigan",
    href: "https://www.linkedin.com/in/megan-tompkins-stange-b71b709/",
  },
  {
    name: "Andrea Vernon",
    imageSrc: "/assets/democratic-grantmaking-26/andrea-vernon.png",
    role: "Executive Director of Experiential Learning and Clinical Professor, University of Montana",
  },
  {
    name: "Danielle McDonald",
    imageSrc: "/assets/democratic-grantmaking-26/danielle-mcdonald.png",
    role: "Professor of Criminal Justice, Northern Kentucky University",
  },
  {
    name: "Julia Paxton",
    imageSrc: "/assets/democratic-grantmaking-26/julia-paxton.png",
    role: "Professor of Economics, Ohio University",
  },
  {
    name: "Nir Eyal",
    imageSrc: "/assets/democratic-grantmaking-26/nir-eyal.png",
    role: "Professor of Bioethics, UCL and Rutgers",
    href: "https://sph.rutgers.edu/directory/nir-eyal",
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
