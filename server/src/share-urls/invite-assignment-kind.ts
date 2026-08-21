/**
 * Leaf module: `share_url` and `user` both need this enum when their column
 * decorators evaluate, and importing it from `invite-assignment` would pull in
 * `share-url.entity` (which imports `User`) and leave the enum undefined
 * mid-cycle.
 */
export enum StoredInviteAssignmentKind {
  Community = "community",
  Open = "open",
}
