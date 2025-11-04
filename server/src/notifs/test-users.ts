import {
  ForumDigestPreference,
  NotificationPreference,
  User,
} from 'src/user/entities/user.entity';

export const getNotifTestUsers = (): User[] => {
  const testUsers: User[] = [];
  if (process.env.NOTIF_TEST_PHONE_NUMBER) {
    testUsers.push({
      id: -1,
      name: 'Test User',
      email: 'test@example.com',
      phoneNumber: process.env.NOTIF_TEST_PHONE_NUMBER,
      phoneNumberValidated: true,
      emailVerified: false,
      contractDateSigned: new Date(0),
      contractDateSuspended: null,
      emailNotifsEnabled: false,
      textNotifsEnabled: true,
      pushNotifsEnabled: false,
      socialNotifsPreference: NotificationPreference.All,
      turnedOffAllNotifs: false,
      forumDigestPreference: ForumDigestPreference.Off,
      password: '',
      admin: false,
      staff: false,
      profilePicture: '',
      profileDescription: '',
      activities: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      sentFriendRequests: [],
      receivedFriendRequests: [],
      notifications: [],
      referredBy: null,
      referredUsers: [],
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
      awayRanges: [],
      anonymous: false,
      actionEventNotifs: [],
      welcomeMail: null,
      groups: [],
    });
  }
  if (process.env.NOTIF_TEST_EMAIL) {
    testUsers.push({
      id: -1,
      name: 'Test User',
      email: process.env.NOTIF_TEST_EMAIL,
      phoneNumberValidated: false,
      emailVerified: true,
      contractDateSigned: new Date(0),
      contractDateSuspended: null,
      emailNotifsEnabled: true,
      textNotifsEnabled: false,
      pushNotifsEnabled: false,
      socialNotifsPreference: NotificationPreference.All,
      turnedOffAllNotifs: false,
      forumDigestPreference: ForumDigestPreference.Off,
      awayRanges: [],
      password: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      admin: false,
      staff: false,
      profilePicture: '',
      profileDescription: '',
      activities: [],
      sentFriendRequests: [],
      receivedFriendRequests: [],
      notifications: [],
      referredBy: null,
      referredUsers: [],
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
      anonymous: false,
      actionEventNotifs: [],
      welcomeMail: null,
      groups: [],
    });
  }
  return testUsers;
};
