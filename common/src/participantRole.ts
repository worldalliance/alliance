export enum ParticipantRole {
  Admin = "admin",
  Member = "member",
  Owner = "owner",
}

export const rolesWithAdminPowers: Record<ParticipantRole, boolean> = {
  [ParticipantRole.Admin]: true,
  [ParticipantRole.Member]: false,
  [ParticipantRole.Owner]: true,
};
