import {
  ActionDto,
  ActionWithRelationDto,
  PostDto,
  ProfileDto,
  UserDto,
} from "@alliance/shared/client";

export const testActions: ActionDto[] = [
  {
    name: "Save 2,500 acres of Ecuador cloud forest",
    description:
      "Acme. corp has been found to lorem over 160,00 ipsums every single year, causing untold devastation in the placeholder text industry.",
    category: "Climate Change",
    id: 1,
    whyJoin: "",
    image: "",
    status: "active",
    timeEstimate: "5 min",
    usersJoined: 234,
    myRelation: {
      status: "joined",
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      dateCommitted: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      dateCompleted: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
    shortDescription:
      "Gold mining companies are expressing interest in a highly biodiverse, unprotected area. We can outpace these companies by purchasing the land from the current owner, Susie.",
    howTo: "",
    type: "Funding",
    usersCompleted: 157,
    events: [],
  },
  {
    name: "Make Target end stocking of Coca-Cola single-use plastic bottles",
    description:
      "This is a description of a task that is doing something else. It is a task that is doing something else. It is a task that is doing something else which is a task that is doing something else.",
    category: "Climate Change",
    id: 2,
    whyJoin: "",
    image: "",
    status: "active",
    timeEstimate: "5 min",
    usersJoined: 234,
    myRelation: {
      status: "joined",
      deadline: new Date().toISOString(),
      dateCommitted: new Date().toISOString(),
      dateCompleted: new Date().toISOString(),
    },
    shortDescription:
      "Target has the power to stop millions of plastic bottles from polluting our planet. By applying pressure, we can make them stop stocking Coca-Cola single-use plastic bottles.",
    howTo: "",
    type: "Activity",
    usersCompleted: 57,
    events: [],
  },
];

export const testActionsWithRelation: ActionWithRelationDto[] = [
  {
    ...testActions[0],
    relation: {
      status: "completed",
      deadline: new Date().toISOString(),
      dateCommitted: new Date().toISOString(),
      dateCompleted: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
  },
  {
    ...testActions[1],
    relation: {
      status: "completed",
      deadline: new Date().toISOString(),
      dateCommitted: new Date().toISOString(),
      dateCompleted: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    },
  },
];

export const testUser: ProfileDto = {
  id: 1,
  name: "First Lastname",
  email: "first.lastname@example.com",
  admin: false,
  profilePicture: "https://via.placeholder.com/150",
  profileDescription:
    "This is a test description of a user thats a sort of medium length. It isn't too long, but it also isn't that short. It has a sort of just right amount of length.",
};

export const testUser2: ProfileDto = {
  id: 2,
  name: "Seconduser Lastname",
  email: "seconduser.lastname@example.com",
  admin: false,
  profilePicture: "https://via.placeholder.com/150",
  profileDescription:
    "This is a test description of a user thats a sort of medium length. It isn't too long, but it also isn't that short. It has a sort of just right amount of length.",
};

export const testAuthUser: UserDto = {
  id: 1,
  name: "First Lastname",
  email: "first.lastname@example.com",
  admin: false,
  onboardingComplete: false,
};

export const testFriends: ProfileDto[] = [testUser, testUser, testUser];

export const testForumPosts: PostDto[] = [
  {
    id: 1,
    title: "First Post",
    content: "This is the content of the first post.",
    authorId: 1,
    replies: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: testAuthUser,
  },
];

export const testTodoActions: ActionDto[] = [
  {
    ...testActions[0],
    myRelation: {
      status: "joined",
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      dateCommitted: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      dateCompleted: new Date().toISOString(),
    },
  },
  {
    ...testActions[1],
    myRelation: {
      status: "joined",
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      dateCommitted: new Date().toISOString(),
      dateCompleted: new Date().toISOString(),
    },
  },
  {
    ...testActions[1],
    type: "Ongoing",
    name: "Stop buying from Coca-Cola",
    myRelation: {
      status: "joined",
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      dateCommitted: new Date().toISOString(),
      dateCompleted: new Date().toISOString(),
    },
  },
];

export const testNotJoinedActions: ActionDto[] = [
  {
    ...testActions[0],
    myRelation: {
      status: "none",
      dateCommitted: "",
      dateCompleted: "",
      deadline: "",
    },
  },
  {
    ...testActions[1],
    myRelation: {
      status: "none",
      dateCommitted: "",
      dateCompleted: "",
      deadline: "",
    },
  },
];

export const chartdata = [
  {
    date: "Jan 24",
    SolarPanels: 2890,
    Inverters: 2338,
  },
  {
    date: "Feb 24",
    SolarPanels: 2756,
    Inverters: 2103,
  },
  {
    date: "Mar 24",
    SolarPanels: 3322,
    Inverters: 2194,
  },
  {
    date: "Apr 24",
    SolarPanels: 3470,
    Inverters: 2108,
  },
  {
    date: "May 24",
    SolarPanels: 3475,
    Inverters: 1812,
  },
  {
    date: "Jun 24",
    SolarPanels: 3129,
    Inverters: 1726,
  },
  {
    date: "Jul 24",
    SolarPanels: 3490,
    Inverters: 1982,
  },
  {
    date: "Aug 24",
    SolarPanels: 2903,
    Inverters: 2012,
  },
  {
    date: "Sep 24",
    SolarPanels: 2643,
    Inverters: 2342,
  },
  {
    date: "Oct 24",
    SolarPanels: 2837,
    Inverters: 2473,
  },
  {
    date: "Nov 24",
    SolarPanels: 2954,
    Inverters: 3848,
  },
  {
    date: "Dec 24",
    SolarPanels: 3239,
    Inverters: 3736,
  },
];
