import { type FindOptionsWhere, In, IsNull } from "typeorm";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "./entities/onetime-invite.entity";

// A `link_used` invite with no live claimant stays claimable: signups before
// claims became transactional could mark one used and then fail, and deleting
// an account leaves its invite used.
const INVITE_STATUS_CLAIMABLE: Record<OnetimeInviteStatus, boolean> = {
  [OnetimeInviteStatus.REQUEST_PENDING]: false,
  [OnetimeInviteStatus.REQUEST_REJECTED]: false,
  [OnetimeInviteStatus.LINK_UNUSED]: true,
  [OnetimeInviteStatus.LINK_USED]: true,
};
const CLAIMABLE_INVITE_STATUSES = Object.values(OnetimeInviteStatus).filter(
  (status) => INVITE_STATUS_CLAIMABLE[status],
);
/**
 * Claimable only while `UserService.inviteHasClaimant` is false as well. The
 * SQL forms below state the same rule; change them together.
 */
export const CLAIMABLE_INVITE = {
  deletedAt: IsNull(),
  status: In(CLAIMABLE_INVITE_STATUSES),
} satisfies FindOptionsWhere<OnetimeInvite>;

export const inviteClaimantSql = (params: {
  invite: string;
  claimant: string;
}): string => `${params.claimant}."referredByInviteId" = ${params.invite}.id`;

/** Whether a live account references the `onetime_invite` row aliased `alias`. */
export const inviteClaimedSql = (alias: string): string =>
  `EXISTS (SELECT 1 FROM "user" claimant WHERE claimant."deletedAt" IS NULL AND ${inviteClaimantSql({ invite: alias, claimant: "claimant" })})`;

/** Whether signup could claim the `onetime_invite` row aliased `alias`. */
export const inviteClaimableSql = (alias: string): string =>
  `${alias}."deletedAt" IS NULL AND ${alias}.status IN (${CLAIMABLE_INVITE_STATUSES.map((status) => `'${status}'`).join(", ")}) AND NOT ${inviteClaimedSql(alias)}`;

/** Whether invite stats count `invite` as accepted. `inviteAcceptedSql` states the same rule; change them together. */
export const isInviteAccepted = (
  invite: Pick<OnetimeInvite, "deletedAt" | "invitedUserId">,
): boolean => invite.deletedAt === null && invite.invitedUserId !== null;

/** Whether invite stats count the `onetime_invite` row aliased `alias` as accepted. */
export const inviteAcceptedSql = (alias: string): string =>
  `(${alias}."deletedAt" IS NULL AND ${inviteClaimedSql(alias)})`;
