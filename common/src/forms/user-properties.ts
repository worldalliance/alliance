import type { Assert, Equal } from "../types";

export enum UserValueProperty {
  Name = "name",
  Email = "email",
  PhoneNumber = "phoneNumber",
  PreferredReminderTime = "preferredReminderTime",
  TimeZone = "timeZone",
  ProfilePicture = "profilePicture",
  ProfileDescription = "profileDescription",
  City = "city",
  CustomCityString = "customCityString",
  Over18 = "over18",
  ClusterId = "clusterId",
  StaffTitle = "staffTitle",
  SwitchedDomainAt = "switchedDomainAt",
  ReferredById = "referredById",
}

export const USER_VALUE_PROPERTY_LABELS = {
  [UserValueProperty.Name]: "Name",
  [UserValueProperty.Email]: "Email",
  [UserValueProperty.PhoneNumber]: "Phone number",
  [UserValueProperty.PreferredReminderTime]: "Preferred reminder time",
  [UserValueProperty.TimeZone]: "Time zone",
  [UserValueProperty.ProfilePicture]: "Profile picture",
  [UserValueProperty.ProfileDescription]: "Profile description",
  [UserValueProperty.City]: "City",
  [UserValueProperty.CustomCityString]: "Custom city",
  [UserValueProperty.Over18]: "Over 18",
  [UserValueProperty.ClusterId]: "Cluster",
  [UserValueProperty.StaffTitle]: "Staff title",
  [UserValueProperty.SwitchedDomainAt]: "Switched domain at",
  [UserValueProperty.ReferredById]: "Referred by",
} as const satisfies Record<UserValueProperty, string>;

export const USER_VALUE_PROPERTIES = Object.values(
  UserValueProperty,
) as UserValueProperty[];

export type UserValuePropertyBag = {
  name: string | null | undefined;
  email: string | null | undefined;
  phoneNumber: string | null | undefined;
  preferredReminderTime: unknown;
  timeZone: unknown;
  profilePicture: string | null | undefined;
  profileDescription: string | null | undefined;
  city: unknown;
  customCityString: string | null | undefined;
  over18: boolean | null | undefined;
  clusterId: number | null | undefined;
  staffTitle: string | null | undefined;
  switchedDomainAt: Date | string | null | undefined;
  referredById: number | null | undefined;
};

type _bagKeys = Assert<
  Equal<keyof UserValuePropertyBag, `${UserValueProperty}`>
>;

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return true;
}

export type UserPropertyPresence = Record<UserValueProperty, boolean>;

const EMPTY_PRESENCE: UserPropertyPresence = {
  [UserValueProperty.Name]: false,
  [UserValueProperty.Email]: false,
  [UserValueProperty.PhoneNumber]: false,
  [UserValueProperty.PreferredReminderTime]: false,
  [UserValueProperty.TimeZone]: false,
  [UserValueProperty.ProfilePicture]: false,
  [UserValueProperty.ProfileDescription]: false,
  [UserValueProperty.City]: false,
  [UserValueProperty.CustomCityString]: false,
  [UserValueProperty.Over18]: false,
  [UserValueProperty.ClusterId]: false,
  [UserValueProperty.StaffTitle]: false,
  [UserValueProperty.SwitchedDomainAt]: false,
  [UserValueProperty.ReferredById]: false,
};

export function emptyUserPropertyPresence(): UserPropertyPresence {
  return { ...EMPTY_PRESENCE };
}

export function userValuePropertyPresence(
  bag: UserValuePropertyBag,
): UserPropertyPresence {
  return {
    [UserValueProperty.Name]: isPresent(bag.name),
    [UserValueProperty.Email]: isPresent(bag.email),
    [UserValueProperty.PhoneNumber]: isPresent(bag.phoneNumber),
    [UserValueProperty.PreferredReminderTime]: isPresent(
      bag.preferredReminderTime,
    ),
    [UserValueProperty.TimeZone]: isPresent(bag.timeZone),
    [UserValueProperty.ProfilePicture]: isPresent(bag.profilePicture),
    [UserValueProperty.ProfileDescription]: isPresent(bag.profileDescription),
    [UserValueProperty.City]:
      bag.city != null || isPresent(bag.customCityString),
    [UserValueProperty.CustomCityString]: isPresent(bag.customCityString),
    [UserValueProperty.Over18]: bag.over18 !== null && bag.over18 !== undefined,
    [UserValueProperty.ClusterId]: bag.clusterId != null,
    [UserValueProperty.StaffTitle]: isPresent(bag.staffTitle),
    [UserValueProperty.SwitchedDomainAt]: isPresent(bag.switchedDomainAt),
    [UserValueProperty.ReferredById]: bag.referredById != null,
  };
}
