import { ContractEventType } from 'src/user/entities/contract-event.entity';
import {
  ForumDigestPreference,
  NotificationPreference,
  PublicFormResponseDefault,
  ReferralSource,
  User,
} from 'src/user/entities/user.entity';

export const testUser = new User({
  id: -1,
  name: 'Test User',
  email: 'test@example.com',
  phoneNumber: process.env.NOTIF_TEST_PHONE_NUMBER,
  phoneNumberValidated: true,
  emailVerified: false,
  devices: [],
  contractEvents: [
    {
      id: -1,
      type: ContractEventType.SIGNED,
      date: new Date(0),
      updatedAt: new Date(),
      automatic: false,
      user: { id: -1 } as User,
    },
  ],
  shareInfoPublicly: false,
  emailNotifsForActions: false,
  textNotifsForActions: true,
  pushNotifsForActions: false,
  socialNotifsPreference: NotificationPreference.All,
  pushesForLikes: false,
  pushesForComments: false,
  pushesForFriendRequests: false,
  turnedOffAllNotifs: false,
  forumDigestPreference: ForumDigestPreference.Off,
  password: '',
  admin: false,
  staff: false,
  ambassador: false,
  leaderOfIds: [],
  profilePicture: '',
  profileDescription: '',
  activities: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  formDataPreference: PublicFormResponseDefault.Public,
  sentFriendRequests: [],
  receivedFriendRequests: [],
  notifications: [],
  referredBy: null,
  referredByInvite: null,
  referredUsers: [],
  shareEmailWithCommunityLead: true,
  undergoingGroupAssignment: false,
  sharePhoneNumberWithCommunityLead: true,
  referralCode: '',
  referralSource: ReferralSource.ReferralLink,
  hashPassword: function (): Promise<void> {
    throw new Error('Function not implemented.');
  },
  generateReferralCode: function (): Promise<void> {
    throw new Error('Function not implemented.');
  },
  checkPassword: function (): Promise<boolean> {
    throw new Error('Function not implemented.');
  },
  stripeCustomerId: '',
  isNotSignedUpPartialProfile: false,
  over18: false,
  awayRanges: [],
  anonymous: false,
  actionEventNotifs: [],
  welcomeMail: null,
  tags: [],
  communities: [],
  leaderOf: [],
  invitedCommunities: [],
  participants: [],
  phoneNumberUnsubscribed: false,
  remindAboutUncompletedGroupMembers: true,
  receiveReplyNotifications: true,
  pushesForMessages: true,
  pushesForActionUpdates: true,
  clusterId: null,
} satisfies Omit<
  User,
  | 'friends'
  | 'hasActiveContract'
  | 'isCommunityLeader'
  | '_hasActiveContractAt'
  | 'hasActiveContractAt'
  | '_hasActiveContractInFullRange'
  | 'hasActiveContractInFullRange'
  | '_isAwayAt'
  | 'isAwayAt'
  | '_isAwayAtAnyPointInRange'
  | 'isAwayAtAnyPointInRange'
  | '_leaderOfIdSet'
  | 'leaderOfIdSet'
>);
