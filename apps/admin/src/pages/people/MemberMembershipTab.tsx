import type { UserAdminDetailDto } from "@alliance/shared/client/types.gen";
import type { useUserAwayRangesAdmin } from "../../lib/useUserAwayRangesAdmin";
import type { useUserDetailAdmin } from "../../lib/useUserDetailAdmin";
import { MemberAwayPanel } from "./MemberAwayPanel";
import { MemberContractPanel } from "./MemberContractPanel";
import { MemberGroupsPanel } from "./MemberGroupsPanel";
import { MemberRolesPanel } from "./MemberRolesPanel";
import { MemberTagsPanel } from "./MemberTagsPanel";
import type { MemberErrorReporting } from "./memberRules";

/** Where the member belongs: groups, time away, roles, tags and contract. */
export function MemberMembershipTab({
  user,
  detail,
  away,
  ...errors
}: MemberErrorReporting & {
  user: UserAdminDetailDto;
  detail: ReturnType<typeof useUserDetailAdmin>;
  away: ReturnType<typeof useUserAwayRangesAdmin>;
}) {
  return (
    <>
      <MemberGroupsPanel user={user} refreshUser={detail.refresh} />
      <MemberAwayPanel member={user} away={away} {...errors} />
      <div className="grid grid-cols-1 items-start gap-section @5xl:grid-cols-2">
        <MemberRolesPanel
          user={user}
          updateRoles={detail.updateRoles.mutateAsync}
        />
        <MemberContractPanel user={user} />
      </div>
      <MemberTagsPanel
        user={user}
        setTagMembership={detail.setTagMembership.mutateAsync}
      />
    </>
  );
}
