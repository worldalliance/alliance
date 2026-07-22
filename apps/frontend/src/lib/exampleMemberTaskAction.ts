import { ActionWithAwayStatus } from "@alliance/shared/lib/actionUtils";

/**
 * Static action for previews of the member task UI on public pages (invite flow,
 * guide, etc.). Not a live server record.
 */
export const exampleMemberTaskAction: ActionWithAwayStatus = {
  name: "Ask your local cafe to switch to compostable cups",
  body: "We negotiated a long-term 20% discount with a compostable cup supplier, available to all cafes that members frequently visit.",
  category: "environment",
  id: 1,
  image: "",
  status: "member_action",
  isContractSigningAction: false,
  onboarding: false,
  isForumParticipationAction: false,
  timeEstimate: 5,
  visibilityMode: "public",
  optional: false,
  usersJoined: 120,
  shortDescription:
    "We negotiated a long-term 20% discount with a compostable cup supplier, available to all cafes that members frequently visit.",
  type: "Activity" as const,
  usersCompleted: 98,
  priority: 0,
  preventCompletion: false,
  shouldCompleteAfterDeadline: false,
  archived: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  publicOnly: false,
  updates: [],
  userRelation: "none" as const,
  canParticipate: true,
  awayStatus: "not_away",
  events: [
    {
      id: 1,
      title: "Event 1",
      description: "Event 1 description",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      newStatus: "member_action",
      suiteManaged: false,
    },
    {
      id: 2,
      title: "Event 2",
      description: "Event 2 description",
      date: new Date(Date.now() - 1000 * 60 * 60 * 49).toISOString(),
      newStatus: "member_action",
      suiteManaged: false,
    },
  ],
  followUpForms: [],
  reviewers: [],
};
