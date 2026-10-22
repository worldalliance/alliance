import {
  group,
  member,
  notifMessage,
  UserNameForm,
  type NamedGroup,
  type NamedUser,
  type NotifMessage,
} from "./notification-content";

export const groupMemberJoinedMessage = (
  joiner: NamedUser,
  community: NamedGroup,
): NotifMessage =>
  notifMessage`${member(joiner, UserNameForm.Public)} joined ${group(community)}!`;

export const memberJoinedYourGroupMessage = (
  joiner: NamedUser,
  community: NamedGroup,
): NotifMessage =>
  notifMessage`${member(joiner)} joined your group (${group(community)})`;

export const assignedToGroupMessage = (community: NamedGroup): NotifMessage =>
  notifMessage`You were assigned to a new group (${group(community)})`;

export const removedFromGroupMessage = (
  remover: NamedUser,
  community: NamedGroup,
): NotifMessage =>
  notifMessage`${member(remover)} removed you from their group (${group(community)})`;

export const memberRemovedFromYourGroupMessage = (params: {
  remover: NamedUser;
  removee: NamedUser;
  community: NamedGroup;
}): NotifMessage =>
  notifMessage`${member(params.remover)} removed ${member(params.removee)} from your group (${group(params.community)})`;

export const memberSuspendedMessage = (params: {
  suspended: NamedUser;
  automatic: boolean;
  community: NamedGroup;
}): NotifMessage =>
  notifMessage`${member(params.suspended)} ${params.automatic ? "was automatically suspended" : "suspended their contract"} and has been removed from your group (${group(params.community)})`;

export const groupInviteMessage = (
  inviter: NamedUser,
  community: NamedGroup,
): NotifMessage =>
  notifMessage`${member(inviter)} invited you to join their group (${group(community)})`;

export const groupInviteAcceptedMessage = (
  invitee: NamedUser,
  community: NamedGroup,
): NotifMessage =>
  notifMessage`${member(invitee)} accepted your invitation to join your group (${group(community)})`;

export const groupInviteDeclinedMessage = (
  invitee: NamedUser,
  community: NamedGroup,
): NotifMessage =>
  notifMessage`${member(invitee)} declined your invitation to join your group (${group(community)})`;

export const groupInviteRequestMessage = (params: {
  requester: NamedUser;
  invitee: NamedUser;
  community: NamedGroup;
}): NotifMessage =>
  notifMessage`${member(params.requester)} requested an invite for ${member(params.invitee)} (${group(params.community)})`;

export const groupInviteRequestApprovedMessage = (
  invitee: NamedUser,
): NotifMessage =>
  notifMessage`Your request to invite ${member(invitee)} was approved`;

export const groupInviteRequestRejectedMessage = (
  invitee: NamedUser,
): NotifMessage =>
  notifMessage`Your request to invite ${member(invitee)} was rejected`;

export const onetimeInviteRequestMessage = (params: {
  requester: NamedUser;
  invitee: string;
  community: NamedGroup;
}): NotifMessage =>
  notifMessage`${member(params.requester)} requested an invite for ${params.invitee} (${group(params.community)})`;

export const onetimeInviteRequestApprovedMessage = (
  invitee: string,
): NotifMessage => notifMessage`Your request to invite ${invitee} was approved`;

export const onetimeInviteRequestRejectedMessage = (
  invitee: string,
): NotifMessage => notifMessage`Your request to invite ${invitee} was rejected`;

export const friendRequestMessage = (requester: NamedUser): NotifMessage =>
  notifMessage`${member(requester)} wants to be friends`;

export const friendRequestAcceptedMessage = (
  addressee: NamedUser,
): NotifMessage =>
  notifMessage`${member(addressee)} accepted your friend request`;
