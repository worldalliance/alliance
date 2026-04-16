import { useMemo, useState } from "react";
import {
  CommunityMemberContactInfoDto,
  ProfileDto,
  UserActionRelationDetailDto,
  UserActionSummaryDto,
} from "@alliance/shared/client";
import {
  getDeadlineTimestampByUserId,
  sortMembersByNextTaskDue,
} from "@alliance/shared/lib/communityMemberActions";
import CommunityMemberTableRow from "./CommunityMemberTableRow";
import DropdownSelect from "./DropdownSelect";

export enum CompletionFilterMode {
  All = "Any status",
  Completed = "Completed",
  NotYetCompleted = "Not yet completed",
}

export enum ContractFilterMode {
  ALL = "All",
  SIGNED = "Signed",
  SUSPENDED = "Suspended",
  NOT_SIGNED = "Not signed",
}

type CommunityMembersTableProps = {
  leaders: ProfileDto[];
  members: ProfileDto[];
  amLeader: boolean;
  communityId?: number;
  onRemoveMember?: (memberId: number) => void;
  memberContactInfo?: Record<number, CommunityMemberContactInfoDto>;
  userActionRelations?: Record<number, UserActionRelationDetailDto[]>;
  actions: UserActionSummaryDto[];
  completedAllCurrentActions?: Record<number, boolean>;
  maxActionsPerWeek: Record<number, number> | null;
  showInfoTooltip?: boolean;
  showContractFilter?: boolean;
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
  showInfoTooltip = false,
  showContractFilter = false,
}: CommunityMembersTableProps) => {
  const [completionFilter, setCompletionFilter] = useState<CompletionFilterMode>(
    CompletionFilterMode.All,
  );
  const [contractFilter, setContractFilter] = useState<ContractFilterMode>(
    showContractFilter ? ContractFilterMode.SIGNED : ContractFilterMode.ALL,
  );
  const visibleActions = useMemo(() => {
    return actions.filter((action) => action.status !== "planned");
  }, [actions]);
  const deadlineTimestampByUserId = useMemo(
    () =>
      getDeadlineTimestampByUserId({
        userActionRelations,
        actions,
      }),
    [userActionRelations, actions],
  );

  const filteredByContract = useMemo(() => {
    if (contractFilter === ContractFilterMode.ALL) {
      return members;
    }
    return members.filter((user) => {
      if (contractFilter === ContractFilterMode.NOT_SIGNED) {
        return !user.lastContractEvent;
      }
      if (contractFilter === ContractFilterMode.SIGNED) {
        return user.lastContractEvent?.type === "signed";
      }
      if (contractFilter === ContractFilterMode.SUSPENDED) {
        return user.lastContractEvent?.type === "suspended";
      }
      return true;
    });
  }, [contractFilter, members]);

  const membersByContract = useMemo(() => {
    return {
      [ContractFilterMode.ALL]: members,
      [ContractFilterMode.SIGNED]: members.filter(
        (user) => user.lastContractEvent?.type === "signed",
      ),
      [ContractFilterMode.SUSPENDED]: members.filter(
        (user) => user.lastContractEvent?.type === "suspended",
      ),
      [ContractFilterMode.NOT_SIGNED]: members.filter(
        (user) => !user.lastContractEvent,
      ),
    };
  }, [members]);

  const membersByCompletion = useMemo(() => {
    return {
      [CompletionFilterMode.All]: filteredByContract,
      [CompletionFilterMode.NotYetCompleted]: filteredByContract.filter(
        (user) => !completedAllCurrentActions[user.id],
      ),
      [CompletionFilterMode.Completed]: filteredByContract.filter(
        (user) => completedAllCurrentActions[user.id],
      ),
    };
  }, [completedAllCurrentActions, filteredByContract]);

  const filteredSortedMembers = useMemo(() => {
    const filtered = membersByCompletion[completionFilter] ?? [];
    if (!amLeader) return filtered;
    return sortMembersByNextTaskDue(
      filtered,
      deadlineTimestampByUserId,
      memberContactInfo,
    );
  }, [
    amLeader,
    completionFilter,
    memberContactInfo,
    membersByCompletion,
    deadlineTimestampByUserId,
  ]);

  const hasActiveFilters =
    completionFilter !== CompletionFilterMode.All ||
    (showContractFilter && contractFilter !== ContractFilterMode.SIGNED);

  const resetFilters = () => {
    setCompletionFilter(CompletionFilterMode.All);
    setContractFilter(
      showContractFilter ? ContractFilterMode.SIGNED : ContractFilterMode.ALL,
    );
  };

  return (
    <div className="flex flex-col py-4 mt-4">
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
              <thead className="text-left">
                <tr>
                  <td colSpan={amLeader ? 4 : 2} className="px-0 pb-4">
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
                    showInfoTooltip={showInfoTooltip}
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
                  <div className="flex flex-row gap-3 items-center">
                    {showContractFilter && (
                      <DropdownSelect
                        options={ContractFilterMode}
                        secondaryLabel={([, mode]) =>
                          membersByContract[mode].length.toString()
                        }
                        value={contractFilter}
                        onChange={([, mode]) => setContractFilter(mode)}
                      />
                    )}
                    <DropdownSelect
                      options={CompletionFilterMode}
                      secondaryLabel={([, mode]) =>
                        membersByCompletion[mode].length.toString()
                      }
                      value={completionFilter}
                      onChange={([, mode]) => setCompletionFilter(mode)}
                    />
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="text-sm text-zinc-500 hover:text-zinc-700 hover:underline"
                      >
                        Reset filters
                      </button>
                    )}
                  </div>
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
                showInfoTooltip={showInfoTooltip}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CommunityMembersTable;
