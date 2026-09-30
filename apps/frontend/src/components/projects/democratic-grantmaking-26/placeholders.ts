// TODO: replace with the waitlist, invite, and member data once the waiting room backend exists.

export interface ProjectPerson {
  name: string;
  role: string;
  pictureKey: string;
}

export const INVITER = {
  name: "Friends of Malheur",
  pictureKey: "1763446793321.webp",
};

export const FEATURED_PEOPLE: ProjectPerson[] = [
  {
    name: "Jordan Ellis",
    role: "Research Advisor",
    pictureKey: "1759973522236.webp",
  },
  {
    name: "Priya Raman",
    role: "Expert",
    pictureKey: "1761437242902.webp",
  },
  {
    name: "Mateo Alvarez",
    role: "Expert",
    pictureKey: "1761437381229.webp",
  },
];

export const MEMBERS: ProjectPerson[] = [
  {
    name: "Sam Okafor",
    role: "Ambassador",
    pictureKey: "1762827526660.webp",
  },
  {
    name: "Lena Fischer",
    role: "Member",
    pictureKey: "1762925939234.webp",
  },
  {
    name: "Noah Kim",
    role: "Group Lead",
    pictureKey: "1762926127931.webp",
  },
  {
    name: "Ava Thompson",
    role: "Member",
    pictureKey: "1762973936500.webp",
  },
  {
    name: "Ravi Patel",
    role: "Member",
    pictureKey: "1763011549832.webp",
  },
  {
    name: "Chloe Martin",
    role: "Member",
    pictureKey: "1763935520222.webp",
  },
  {
    name: "Diego Santos",
    role: "Member",
    pictureKey: "1763935553152.webp",
  },
  {
    name: "Grace Liu",
    role: "Member",
    pictureKey: "1765237298519.webp",
  },
];

const LOREM =
  "Lorem ipsum dolor sit amet consectetur adipiscing elit possimus in fugiat dolor minim veniam labore illum ducimus non sunt et velit nam nobis est dolore voluptas optio dolor vel praesentium nostrud minus cillum qui in do rerum praesentium libero cumque qui pariatur quibusdam aliquip nobis nihil eligendi laboris sunt est.";

export const ABOUT_SECTIONS = [
  { heading: "What this is", body: LOREM },
  { heading: "How it works", body: LOREM },
  { heading: "Why we’re doing this", body: LOREM },
];
