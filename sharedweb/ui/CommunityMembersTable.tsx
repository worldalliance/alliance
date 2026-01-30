import { useMemo, useState } from "react";
import {
  CommunityMemberContactInfoDto,
  ProfileDto,
  UserActionRelationDetailDto,
  UserActionRelationPillStatus,
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

const DEADLINE_IN_CONSIDERATION = {
  away: false,
  completed: false,
  missed_deadline: false,
  not_required: false,
  optional_task: false,
  todo: true,
  wont_complete: false,
} satisfies Record<UserActionRelationPillStatus, boolean>;

type CommunityMembersTableProps = {
  leaders: ProfileDto[];
  members: ProfileDto[];
  amLeader: boolean;
  communityId: number;
  onRemoveMember?: (memberId: number) => void;
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
  communityId,
  onRemoveMember,
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
  const deadlineTimestampByUserId = useMemo(() => {
    const visibleActionsById = new Map(
      visibleActions.map((action) => [action.id, action])
    );

    return new Map(
      Object.entries(userActionRelations).map(([userIdKey, relations]) => {
        let deadline = Infinity;
        for (const relation of relations) {
          const action = visibleActionsById.get(relation.actionId);
          if (
            !action ||
            !DEADLINE_IN_CONSIDERATION[relation.status] ||
            action.latestMemberActionDeadline === null
          ) {
            continue;
          }
          deadline = Math.min(deadline, action.latestMemberActionDeadline);
        }
        return [+userIdKey, deadline];
      })
    );
  }, [visibleActions, userActionRelations]);

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

      const deadlineA = deadlineTimestampByUserId.get(a.id) ?? Infinity;
      const deadlineB = deadlineTimestampByUserId.get(b.id) ?? Infinity;
      if (deadlineA < deadlineB) {
        return -1;
      }
      if (deadlineA > deadlineB) {
        return 1;
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
  }, [
    amLeader,
    filterMode,
    memberContactInfo,
    membersByFilterMode,
    deadlineTimestampByUserId,
  ]);

  return (
    <div className="flex flex-col py-4">
      <div className="">
        <table className="w-full border-collapse table-auto overflow-x-clip">
          <colgroup>
            <col className="w-[140px] md:w-[200px]" />
            <col />
            {amLeader && (
              <>
                <col className="w-[1%]" />
                <col className="w-[1%]" />
              </>
            )}
          </colgroup>
          {leaders.length > 0 && (
            <>
              <thead className="text-left bg-white">
                <tr>
                  <td colSpan={amLeader ? 4 : 2} className="px-0 pb-6">
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
                    <>
                      <th
                        scope="col"
                        className="font-medium md:whitespace-nowrap"
                      >
                        Contact time
                      </th>
                      <th
                        scope="col"
                        className="font-medium md:whitespace-nowrap"
                      >
                        Next task due
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="border-y md:border border-zinc-200">
                {leaders.map((user) => (
                  <CommunityMemberTableRow
                    key={user.id}
                    profile={user}
                    communityId={communityId}
                    canExpand={amLeader}
                    canRemove={false}
                    amLeader={amLeader}
                    contactInfo={memberContactInfo?.[user.id]}
                    actionRelations={userActionRelations?.[user.id] ?? []}
                    actions={visibleActions}
                    maxActionsPerWeek={maxActionsPerWeek}
                    deadlineTimestamp={deadlineTimestampByUserId.get(user.id)}
                  />
                ))}
              </tbody>
            </>
          )}
          <thead className="text-left">
            <tr>
              <td colSpan={amLeader ? 4 : 2} className="px-5 md:px-0 pb-6 pt-6">
                <div className="flex flex-col gap-y-2">
                  <p className="text-xl md:text-2xl font-semibold">Members</p>
                  <p className="text-zinc-500 text-sm">
                    Sort by completion of current actions
                  </p>
                  <DropdownSelect
                    options={CommunityMembersFilterMode}
                    secondaryLabel={([, mode]) =>
                      membersByFilterMode[mode].length.toString()
                    }
                    value={filterMode}
                    onChange={([, mode]) => setFilterMode(mode)}
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
                <>
                  <th scope="col" className="font-medium md:whitespace-nowrap">
                    Contact time
                  </th>
                  <th scope="col" className="font-medium md:whitespace-nowrap">
                    Next task due
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="border-y md:border border-zinc-200">
            {filteredSortedMembers.map((user) => (
              <CommunityMemberTableRow
                key={user.id}
                profile={user}
                communityId={communityId}
                onRemoveMember={onRemoveMember}
                canExpand={amLeader}
                amLeader={amLeader}
                canRemove={!!(amLeader && onRemoveMember)}
                contactInfo={memberContactInfo?.[user.id]}
                actionRelations={userActionRelations?.[user.id] ?? []}
                actions={visibleActions}
                maxActionsPerWeek={maxActionsPerWeek}
                deadlineTimestamp={deadlineTimestampByUserId.get(user.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CommunityMembersTable;
