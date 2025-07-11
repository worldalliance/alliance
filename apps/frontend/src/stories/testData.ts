import {
  ActionActivityDto,
  ActionDto,
  ActionWithRelationDto,
  PostDto,
  ProfileDto,
  UserDto,
} from "@alliance/shared/client";

export const testActions: ActionDto[] = [
  {
    name: "Save 2,500 acres of Ecuador cloud forest",
    body: "The Alliance is a global group of people that abide by a process which governs the use of our collective power. We seek to unite millions to billions of people into one cooperative force that represents humanity's collective interests. \n \n Our mission is to build a civilization that serves all individuals in their pursuit of life, liberty, and happiness – a world in which we can take pride. Most pressingly, we seek to resolve ongoing global crises, which include environmental destruction, extreme poverty, democratic dysfunction, and unsafe technological development. It is our aim to end these crises in their entirety in the coming years, not to make incremental improvements \n\n\n The Alliance is a global group of people that abide by a process which governs the use of our collective power. We seek to unite millions to billions of people into one cooperative force that represents humanity's collective interests. \n \n Our mission is to build a civilization that serves all individuals in their pursuit of life, liberty, and happiness – a world in which we can take pride. Most pressingly, we seek to resolve ongoing global crises, which include environmental destruction, extreme poverty, democratic dysfunction, and unsafe technological development. It is our aim to end these crises in their entirety in the coming years, not to make incremental improvements",
    category: "Climate Change",
    id: 1,
    image: "",
    status: "gathering_commitments",
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
    type: "Funding",
    usersCompleted: 157,
    events: [
      {
        id: 1,
        title: "Event 1",
        description: "Event 1 description",
        date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        newStatus: "member_action",
        showInTimeline: true,
        sendNotifsTo: "all",
      },
      {
        id: 2,
        title: "Event 2",
        description: "Event 2 description",
        date: new Date(Date.now() - 1000 * 60 * 60 * 49).toISOString(),
        newStatus: "member_action",
        showInTimeline: true,
        sendNotifsTo: "all",
      },
    ],
  },
  {
    name: "Make Target end stocking of Coca-Cola single-use plastic bottles",
    body: "This is a description of a task that is doing something else. It is a task that is doing something else. It is a task that is doing something else which is a task that is doing something else.",
    category: "Climate Change",
    id: 2,
    image: "",
    status: "gathering_commitments",
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
  displayName: "First Lastname",
  email: "first.lastname@example.com",
  admin: false,
  profilePicture: "https://via.placeholder.com/150",
  profileDescription:
    "This is a test description of a user thats a sort of medium length. It isn't too long, but it also isn't that short. It has a sort of just right amount of length.",
};

export const testUser2: ProfileDto = {
  id: 2,
  displayName: "Seconduser Lastname",
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
  referralCode: "1234567890",
  anonymous: false,
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
    status: "member_action",
    myRelation: {
      status: "joined",
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      dateCommitted: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      dateCompleted: new Date().toISOString(),
    },
  },
  {
    ...testActions[1],
    status: "member_action",
    myRelation: {
      status: "joined",
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      dateCommitted: new Date().toISOString(),
      dateCompleted: new Date().toISOString(),
    },
  },
  {
    ...testActions[1],
    status: "member_action",
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

export const testActivities: ActionActivityDto[] = [
  {
    id: 1,
    type: "user_joined",
    createdAt: new Date().toISOString(),
    user: {
      id: 0,
      email: "jo@example.com",
      admin: false,
      profilePicture: null,
      profileDescription: null,
      displayName: "John Doe",
    },
  },
  {
    id: 2,
    type: "user_joined",
    createdAt: new Date().toISOString(),
    user: {
      id: 1,
      email: "jo@example.com",
      admin: false,
      profilePicture: null,
      profileDescription: null,
      displayName: "Some One",
    },
  },
];
