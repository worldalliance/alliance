import { CreateActionDto, UserDto } from "@alliance/shared/client";
import { milliseconds } from "date-fns";

export const FORM_BUILDER_PREVIEW_USER: UserDto = {
  id: 0,
  name: "Preview User",
  phoneNumber: null,
  preferredReminderTime: null,
  customCityString: null,
  emailNotifsForActions: false,
  textNotifsForActions: false,
  pushNotifsForActions: false,
  turnedOffAllNotifs: false,
  forumDigestPreference: "off",
  switchedDomainAt: null,
  admin: false,
  staff: false,
  ambassador: false,
  pushesForMessages: true,
  referralSource: "onetime_invite",
  referredById: null,
  referredByCampaignId: null,
  shareEmailWithCommunityLead: true,
  sharePhoneNumberWithCommunityLead: true,
  profileDescription: "I am a preview user",
  shareInfoPublicly: true,
  pushesForLikes: true,
  pushesForComments: true,
  profilePicture: null,
  communities: [],
  tags: [],
  formDataPreference: "public",
  hasActiveContract: true,
  referralCode: "preview-referral-code",
  anonymous: false,
  email: "preview@example.com",
  contractEvents: [
    {
      type: "signed",
      date: new Date(Date.now() - milliseconds({ days: 30 })).toISOString(),
      automatic: false,
      contractId: 1,
    },
  ],
  pushesForFriendRequests: false,
  undergoingGroupAssignment: false,
  remindAboutUncompletedGroupMembers: false,
  leaderOfIds: [],
  receiveReplyNotifications: false,
  pushesForActionUpdates: false,
  clusterId: null,
  hasPassword: true,
};

export const testActions: CreateActionDto[] = [
  // Funding Action 1
  {
    name: "Save 2,500 acres of Ecuador cloud forest",
    category: "Climate Change",
    body: `Protect Ecuador's Biodiversity Hotspot

## The Crisis
Gold mining companies are expressing interest in a highly biodiverse area of Ecuador's cloud forest. This pristine ecosystem is home to countless species of plants, animals, and insects found nowhere else on Earth.

## Our Solution
We can outpace these mining companies by purchasing the land directly and placing it under permanent protection. Every dollar donated goes directly toward land acquisition and legal protection.

## Impact
- **2,500 acres** of pristine cloud forest protected
- **Hundreds of species** safeguarded from extinction
- **Carbon sequestration** equivalent to taking 1,000 cars off the road
- **Indigenous rights** protected and respected

## How It Works
1. We identify critical parcels of land under threat
2. Local partners negotiate with landowners
3. Legal protections are put in place
4. Long-term stewardship is established

This is our chance to take direct action against environmental destruction. Every contribution makes a difference.`,
    shortDescription:
      "Gold mining companies are expressing interest in a highly biodiverse area. We can outpace them by purchasing the land.",
    timeEstimate: 5,
    preventCompletion: false,
    visibilityMode: "public",
    onboarding: false,
    optional: false,
    publicOnly: false,
    shouldCompleteAfterDeadline: false,
    isContractSigningAction: false,
    isForumParticipationAction: false,
  },
];
