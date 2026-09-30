import { type FindOptionsWhere, In, IsNull } from "typeorm";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "./entities/onetime-invite.entity";

// A `link_used` invite with no claimant stays claimable: signups before claims
// became transactional could mark one used and then fail, and deleting an
// account leaves its invite used.
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

/** Whether an account references the `onetime_invite` row aliased `alias`. */
export const inviteClaimedSql = (alias: string): string =>
  `EXISTS (SELECT 1 FROM "user" claimant WHERE claimant."referredByInviteId" = ${alias}.id)`;

/** Whether signup could claim the `onetime_invite` row aliased `alias`. */
export const inviteClaimableSql = (alias: string): string =>
  `${alias}."deletedAt" IS NULL AND ${alias}.status IN (${CLAIMABLE_INVITE_STATUSES.map((status) => `'${status}'`).join(", ")}) AND NOT ${inviteClaimedSql(alias)}`;
