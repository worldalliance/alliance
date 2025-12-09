import {
  ForumDigestPreference,
  NotificationPreference,
  PublicFormResponseDefault,
  User,
} from 'src/user/entities/user.entity';
import { NotificationChannel } from './notif-utils';
import { ContractEventType } from 'src/user/entities/contract-event.entity';

export const testUser: User = {
  id: -1,
  name: 'Test User',
  email: 'test@example.com',
  phoneNumber: process.env.NOTIF_TEST_PHONE_NUMBER,
  phoneNumberValidated: true,
  emailVerified: false,
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
  hasActiveContract: true,
  emailNotifsEnabled: false,
  textNotifsEnabled: true,
  pushNotifsEnabled: false,
  socialNotifsPreference: NotificationPreference.All,
  turnedOffAllNotifs: false,
  forumDigestPreference: ForumDigestPreference.Off,
  password: '',
  admin: false,
  staff: false,
  leaderOfIds: [],
  isCommunityLeader: false,
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
  referredUsers: [],
  shareEmailWithCommunityLead: true,
  sharePhoneNumberWithCommunityLead: true,
  referralCode: '',
  friends: [],
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
  onboardingComplete: false,
  preferredActionReminderChannel: NotificationChannel.Text,
  awayRanges: [],
  anonymous: false,
  actionEventNotifs: [],
  welcomeMail: null,
  tags: [],
  communities: [],
  leaderOf: [],
  invitedCommunities: [],
  participants: [],
};
