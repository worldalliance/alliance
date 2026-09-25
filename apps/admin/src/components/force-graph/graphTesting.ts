import type { Community, Tag, UserDto } from "@alliance/shared/client";
import { select } from "d3";
import {
  type ForceGraphLink,
  type ForceGraphNode,
  linkEnd,
} from "./ForceGraph";

export const community = (id: number, name: string): Community => ({
  id,
  name,
  description: "",
  photo: null,
  public: true,
  allowMemberInvites: true,
  allowStaffAssignments: true,
  maxCapacity: null,
  users: [],
  internalInvites: [],
});

export const tag = (id: string, name: string): Tag => ({
  id,
  name,
  description: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  users: [],
  generalUpdates: [],
});

export const user = (
  overrides: Partial<UserDto> & Pick<UserDto, "id" | "name">,
): UserDto => ({
  email: `${overrides.name}@example.com`,
  phoneNumber: null,
  preferredReminderTime: null,
  timeZone: null,
  emailNotifsForActions: false,
  textNotifsForActions: false,
  pushNotifsForActions: false,
  shareEmailWithCommunityLead: false,
  sharePhoneNumberWithCommunityLead: false,
  turnedOffAllNotifs: false,
  forumDigestPreference: "off",
  switchedDomainAt: null,
  admin: false,
  staff: false,
  ambassador: false,
  profilePicture: null,
  profileDescription: null,
  referralCode: `code-${overrides.id}`,
  customCityString: null,
  anonymous: false,
  shareInfoPublicly: false,
  formDataPreference: "private",
  pushesForLikes: false,
  pushesForComments: false,
  pushesForFriendRequests: false,
  pushesForMessages: false,
  pushesForActionUpdates: false,
  undergoingGroupAssignment: false,
  remindAboutUncompletedGroupMembers: false,
  receiveReplyNotifications: false,
  referredById: null,
  referralSource: "none",
  referredByCampaignId: null,
  tags: [],
  communities: [],
  leaderOfIds: [],
  clusterId: null,
  hasActiveContract: true,
  hasPassword: true,
  ...overrides,
});

export const drawnNode = (container: HTMLElement, name: string) => {
  const title = Array.from(container.querySelectorAll("title")).find(
    (t) => t.textContent === name,
  );
  if (!title?.parentElement) throw new Error(`node ${name} is not drawn`);
  return title.parentElement;
};

export const drawnCircleStroke = (container: HTMLElement, name: string) =>
  drawnNode(container, name).querySelector("circle")?.getAttribute("stroke");

/** Drawn lines keyed "sourceName->targetName". */
export const drawnLinks = (container: HTMLElement) =>
  new Map(
    Array.from(container.querySelectorAll("line")).map((line) => {
      const d = select<SVGLineElement, ForceGraphLink<ForceGraphNode>>(
        line,
      ).datum();
      const name = `${linkEnd(d.source).displayName}->${linkEnd(d.target).displayName}`;
      return [name, line];
    }),
  );
