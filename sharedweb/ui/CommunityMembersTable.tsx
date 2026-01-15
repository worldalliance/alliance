import { useMemo, useState } from "react";
import {
  CommunityMemberContactInfoDto,
  ProfileDto,
  UserActionRelationDetailDto,
  UserActionSummaryDto,
} from "@alliance/shared/client";
import { parseTimeInput } from "../forms/timeUtils";
import CommunityMemberTableRow from "./CommunityMemberTableRow";
import DropdownSelect from "./DropdownSelect";

export enum CommunityMembersFilterMode {
  All = "All members",
  Completed = "Completed",
  NotYetCompleted = "Not yet completed",
}

type CommunityMembersTableProps = {
  leaders: ProfileDto[];
  members: ProfileDto[];
  amLeader: boolean;
  memberContactInfo?: Record<number, CommunityMemberContactInfoDto>;
  userActionRelations?: Record<number, UserActionRelationDetailDto[]>;
  actions: UserActionSummaryDto[];
  completedAllCurrentActions?: Record<number, boolean>;
  maxActionsPerWeek: Record<number, number> | null;
};

const CommunityMembersTable = ({
  leaders,
  members,
  amLeader,
  memberContactInfo = {},
  userActionRelations = {},
  actions,
  completedAllCurrentActions = {},
  maxActionsPerWeek,
}: CommunityMembersTableProps) => {
  const [filterMode, setFilterMode] = useState<CommunityMembersFilterMode>(
    CommunityMembersFilterMode.All
  );
  const visibleActions = useMemo(() => {
    return actions.filter((action) => action.status !== "planned");
  }, [actions]);

  const membersByFilterMode = useMemo(() => {
    return {
      [CommunityMembersFilterMode.All]: members,
      [CommunityMembersFilterMode.NotYetCompleted]: members.filter(
        (user) => !completedAllCurrentActions[user.id]
      ),
      [CommunityMembersFilterMode.Completed]: members.filter(
        (user) => completedAllCurrentActions[user.id]
      ),
    };
  }, [completedAllCurrentActions, members]);

  const filteredSortedMembers = useMemo(() => {
    const filtered = membersByFilterMode[filterMode] ?? [];

    return [...filtered].sort((a, b) => {
      if (!amLeader) {
        return 0;
      }

      const preferredTimeA =
        memberContactInfo?.[a.id]?.preferredReminderTimeLeaderTz ?? "";
      const preferredTimeB =
        memberContactInfo?.[b.id]?.preferredReminderTimeLeaderTz ?? "";

      const timeA = parseTimeInput(preferredTimeA);
      const timeB = parseTimeInput(preferredTimeB);

      if (timeA && timeB) {
        return timeA.minutes - timeB.minutes;
      }

      if (!timeA && timeB) {
        return -1;
      }
      if (timeA && !timeB) {
        return 1;
      }
      return 0;
    });
  }, [amLeader, filterMode, memberContactInfo, membersByFilterMode]);

  return (
    <div className="flex flex-col py-4">
      <div className="">
        <table className="w-full border-collapse table-fixed overflow-x-clip">
          <colgroup>
            <col className="w-[140px] md:w-[200px]" />
            <col />
            {amLeader && <col className={`w-[90px] md:w-[180px]`} />}
          </colgroup>
          {leaders.length > 0 && (
            <>
              <thead className="text-left bg-white">
                <tr>
                  <td colSpan={amLeader ? 3 : 2} className="px-0 pb-6">
                    <p className="text-xl md:text-2xl font-semibold px-5 md:px-0">
                      Lead{leaders.length !== 1 ? "s" : ""}
                    </p>
                  </td>
                </tr>
              </thead>
              <thead className="text-left bg-zinc-50">
                <tr className="*:py-4 *:px-2 *:md:px-4 border-y md:border border-zinc-200 text-xs md:text-sm text-zinc-600">
                  <th scope="col" className="font-medium">
                    Name
                  </th>
                  <th scope="col" className="font-medium">
                    Action history
                  </th>
                  {amLeader && (
                    <th
                      scope="col"
                      className="font-medium md:whitespace-nowrap"
                    >
                      Preferred contact time
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="border-y md:border border-zinc-200">
                {leaders.map((user) => (
                  <CommunityMemberTableRow
                    key={user.id}
                    profile={user}
                    canExpand={amLeader}
                    amLeader={amLeader}
                    contactInfo={memberContactInfo?.[user.id]}
                    actionRelations={userActionRelations?.[user.id] ?? []}
                    actions={visibleActions}
                    maxActionsPerWeek={maxActionsPerWeek}
                  />
                ))}
              </tbody>
            </>
          )}
          <thead className="text-left">
            <tr>
              <td colSpan={amLeader ? 3 : 2} className="px-5 md:px-0 pb-6 pt-6">
                <div className="flex flex-col gap-y-2">
                  <p className="text-xl md:text-2xl font-semibold">Members</p>
                  <p className="text-zinc-500 text-sm">
                    Sort by completion of current actions
                  </p>
                  <DropdownSelect
                    options={CommunityMembersFilterMode}
                    secondaryLabel={(_, mode) =>
                      membersByFilterMode[mode].length.toString()
                    }
                    value={filterMode}
                    onChange={(_, mode) => setFilterMode(mode)}
                  />
                </div>
              </td>
            </tr>
          </thead>
          <thead className="text-left bg-zinc-50">
            <tr className="*:py-4 *:px-2 *:md:px-4 border-y md:border border-zinc-200 text-xs md:text-sm text-zinc-600">
              <th scope="col" className="font-medium">
                Name
              </th>
              <th scope="col" className="font-medium">
                Action history
              </th>
              {amLeader && (
                <th scope="col" className="font-medium md:whitespace-nowrap">
                  Preferred contact time
                </th>
              )}
            </tr>
          </thead>
          <tbody className="border-y md:border border-zinc-200">
            {filteredSortedMembers.map((user) => (
              <CommunityMemberTableRow
                key={user.id}
                profile={user}
                canExpand={amLeader}
                amLeader={amLeader}
                contactInfo={memberContactInfo?.[user.id]}
                actionRelations={userActionRelations?.[user.id] ?? []}
                actions={visibleActions}
                maxActionsPerWeek={maxActionsPerWeek}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CommunityMembersTable;
