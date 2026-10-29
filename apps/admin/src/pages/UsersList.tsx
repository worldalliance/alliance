import { withCount } from "@alliance/common/plural";
import {
  ProfileDto,
  UserActionRelationDetailDto,
} from "@alliance/shared/client/types.gen";
import { shuffleWithSeed } from "@alliance/shared/forms/randomutils";
import { cn } from "@alliance/shared/styles/util";
import CommunityMembersTable from "@alliance/sharedweb/ui/CommunityMembersTable";
import Pagination from "@alliance/sharedweb/ui/Pagination";
import { useMaxActionsPerWeek } from "@alliance/sharedweb/ui/UserProgressPills";
import { groupBy, mapValues } from "es-toolkit";
import { LayoutGrid, List, Shuffle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { href, Link, useSearchParams } from "react-router";
import MemberFilterDropdown from "../components/MemberFilterDropdown";
import UserCard from "../components/UserCard";
import { adminRefusalMessage } from "../lib/adminRefusal";
import {
  matchesSelectedRoles,
  ROLE_FILTERS,
  RoleFilter,
} from "../lib/memberRoleFilter";
import { memberSearchMatcher } from "../lib/memberSearch";
import { useActionRelationsAdmin } from "../lib/useActionRelationsAdmin";
import { useCompletedAllActiveActions } from "../lib/useCompletedAllActiveActions";
import { useMemberContactInfoAdmin } from "../lib/useMemberContactInfoAdmin";
import { useTagsAdmin } from "../lib/useTagsAdmin";
import { useTimeSpentPerUserTotalAdmin } from "../lib/useTimeSpentPerUserTotalAdmin";
import { useUsersAdmin } from "../lib/useUsersAdmin";

type ViewMode = "cards" | "rows";

const MEMBERS_PER_PAGE = 50;
const NO_TIMES: Record<number, number> = {};

const UsersList: React.FC = () => {
  const { data: users = [] } = useUsersAdmin();
  const timeSpentTotal = useTimeSpentPerUserTotalAdmin();
  const userToTimeSpentTotal = timeSpentTotal.data ?? NO_TIMES;
  const { tags, addUserToTag, removeUserFromTag } = useTagsAdmin();
  const { data: relationsResponse } = useActionRelationsAdmin();
  // latest on the right
  const actionSummaries = useMemo(
    () => (relationsResponse?.actions ?? []).slice().reverse(),
    [relationsResponse],
  );
  const userActionRelations = useMemo(() => {
    const relationMap: Record<number, UserActionRelationDetailDto[]> = {};
    for (const entry of relationsResponse?.users ?? []) {
      relationMap[entry.userId] = entry.relations ?? [];
    }
    return relationMap;
  }, [relationsResponse]);
  const maxActionsPerWeek = useMaxActionsPerWeek({
    actionSummaries,
    userActionRelations,
  });
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<RoleFilter[]>([]);
  const [pendingTagOps, setPendingTagOps] = useState<Set<string>>(
    () => new Set(),
  );
  const [tagMutationError, setTagMutationError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [params, setParams] = useSearchParams();
  const viewMode = (params.get("viewMode") as ViewMode | undefined) ?? "rows";

  const [shuffledIds, setShuffledIds] = useState<number[] | null>(null);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      return (
        (userToTimeSpentTotal[b.id] ?? 0) - (userToTimeSpentTotal[a.id] ?? 0)
      );
    });
  }, [users, userToTimeSpentTotal]);

  const userTagsMap = useMemo(() => {
    const userTags = tags.flatMap((tag) =>
      tag.users.map((profile) => ({ userId: profile.id, tag })),
    );
    return mapValues(
      groupBy(userTags, (entry) => entry.userId),
      (entries) => entries.map((entry) => entry.tag),
    );
  }, [tags]);

  const filteredByRoles = useMemo(() => {
    if (!selectedRoles.length) {
      return sortedUsers;
    }
    return sortedUsers.filter((user) =>
      matchesSelectedRoles({ user, selectedRoles }),
    );
  }, [selectedRoles, sortedUsers]);

  const filteredByTags = useMemo(() => {
    if (!selectedTagIds.length) {
      return filteredByRoles;
    }
    const selected = new Set(selectedTagIds);
    return filteredByRoles.filter((user) => {
      const userTags = userTagsMap[user.id] || [];
      return userTags.some((tag) => selected.has(tag.id));
    });
  }, [selectedTagIds, filteredByRoles, userTagsMap]);

  const filteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) {
      return filteredByTags;
    }
    return filteredByTags.filter(memberSearchMatcher(searchQuery));
  }, [filteredByTags, searchQuery]);

  const handleShuffle = useCallback(() => {
    const current = filteredBySearch;

    const seed = Math.random().toString(36).substring(2, 15);
    setShuffledIds(
      shuffleWithSeed(
        current.map((u) => u.id),
        seed,
      ),
    );
  }, [filteredBySearch]);

  useEffect(() => {
    setShuffledIds(null);
  }, [selectedTagIds, selectedRoles, searchQuery]);

  const roleMemberCounts = useMemo(
    () =>
      mapValues(ROLE_FILTERS, (filter) => users.filter(filter.matches).length),
    [users],
  );

  const resetAllFilters = () => {
    setSearchQuery("");
    setSelectedTagIds([]);
    setSelectedRoles([]);
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedTagIds.length > 0 ||
    selectedRoles.length > 0;

  const usersAsProfiles = useMemo((): ProfileDto[] => {
    return filteredBySearch.map((user) => {
      return {
        id: user.id,
        admin: user.admin,
        staff: user.staff,
        ambassador: user.ambassador,
        profilePicture: user.profilePicture,
        profileDescription: user.profileDescription,
        displayName: user.name,
        hasActiveContract: user.hasActiveContract,
        isCommunityLeader: false,
        lastContractEvent: user.lastContractEvent,
        anonymous: user.anonymous,
      };
    });
  }, [filteredBySearch]);

  const completedAllCurrentActions = useCompletedAllActiveActions({
    actionSummaries,
    userActionRelations,
  });

  const displayedUsers = useMemo(() => {
    if (
      shuffledIds != null &&
      shuffledIds.length === filteredBySearch.length &&
      filteredBySearch.every((u) => shuffledIds!.includes(u.id))
    ) {
      const byId = Object.fromEntries(filteredBySearch.map((u) => [u.id, u]));
      return shuffledIds.map((id) => byId[id]).filter(Boolean);
    }
    return filteredBySearch;
  }, [filteredBySearch, shuffledIds]);

  const [cardPage, setCardPage] = useState(1);
  // New search/filter/shuffle → back to the first page. Keyed on the filter
  // inputs, not the derived array: a background refetch that only changes
  // user fields must not yank the viewer back to the first page.
  useEffect(() => {
    setCardPage(1);
  }, [searchQuery, selectedTagIds, shuffledIds]);

  const cardTotalPages = Math.max(
    1,
    Math.ceil(displayedUsers.length / MEMBERS_PER_PAGE),
  );
  const currentCardPage = Math.min(cardPage, cardTotalPages);

  const visibleCardUsers = useMemo(
    () =>
      displayedUsers.slice(
        (currentCardPage - 1) * MEMBERS_PER_PAGE,
        currentCardPage * MEMBERS_PER_PAGE,
      ),
    [displayedUsers, currentCardPage],
  );

  const displayedProfiles = useMemo((): ProfileDto[] => {
    const list = usersAsProfiles;
    if (
      shuffledIds != null &&
      shuffledIds.length === list.length &&
      list.every((p) => shuffledIds!.includes(p.id))
    ) {
      const byId = Object.fromEntries(list.map((p) => [p.id, p]));
      return shuffledIds.map((id) => byId[id]).filter(Boolean);
    }
    return list;
  }, [usersAsProfiles, shuffledIds]);

  const { data: memberContactInfo } = useMemberContactInfoAdmin();

  const handleUserTagToggle = useCallback(
    async (userId: number, tagId: string, nextChecked: boolean) => {
      const key = `${userId}-${tagId}`;
      setPendingTagOps((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      setTagMutationError(null);
      try {
        const mutateAsync = nextChecked
          ? addUserToTag.mutateAsync
          : removeUserFromTag.mutateAsync;
        await mutateAsync({ tagId, body: { userId } });
      } catch (error) {
        console.error("Failed to update tag membership", error);
        setTagMutationError("Failed to update tag membership. Try again.");
      } finally {
        setPendingTagOps((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [addUserToTag.mutateAsync, removeUserFromTag.mutateAsync],
  );

  return (
    <div className="h-full p-5 flex flex-col items-center gap-y-3 overflow-x-clip bg-zinc-50">
      <div className="flex flex-row gap-3 w-full items-center">
        <input
          type="text"
          autoFocus
          placeholder="Search by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="text-sm border border-gray-2 text-black bg-white px-3 rounded-sm py-2 w-64 focus:outline-none focus:border-black"
        />
        <div className="flex flex-row gap-3 items-center">
          <MemberFilterDropdown
            title="Roles"
            noun="role"
            options={Object.values(RoleFilter).map((role) => ({
              value: role,
              label: ROLE_FILTERS[role].label,
              memberCount: roleMemberCounts[role],
            }))}
            selected={selectedRoles}
            onChange={setSelectedRoles}
          />
          <MemberFilterDropdown
            title="Tags"
            noun="tag"
            options={tags.map((tag) => ({
              value: tag.id,
              label: tag.name,
              memberCount: tag.users.length,
            }))}
            selected={selectedTagIds}
            onChange={setSelectedTagIds}
          />
        </div>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-sm text-zinc-500 hover:text-zinc-700 hover:underline"
            >
              Reset filters
            </button>
          )}
          <Link
            to={href("/members/tags")}
            className="text-sm text-blue-600 hover:underline"
          >
            Manage tags
          </Link>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={handleShuffle}
            className="p-2 rounded hover:bg-zinc-100"
            title="Shuffle view"
          >
            <Shuffle size={18} className="text-zinc-600" />
          </button>
          <button
            type="button"
            onClick={() => setParams({ viewMode: "rows" })}
            className={cn(
              "p-2 rounded",
              viewMode === "rows" ? "bg-zinc-200" : "hover:bg-zinc-100",
            )}
            title="Table view"
          >
            <List size={18} className="text-zinc-600" />
          </button>
          <button
            type="button"
            onClick={() => setParams({ viewMode: "cards" })}
            className={cn(
              "p-2 rounded",
              viewMode === "cards" ? "bg-zinc-200" : "hover:bg-zinc-100",
            )}
            title="Card view"
          >
            <LayoutGrid size={18} className="text-zinc-600" />
          </button>
        </div>
      </div>
      {timeSpentTotal.isLoadingError && (
        <p role="alert" className="w-full text-sm text-red-500">
          {adminRefusalMessage(
            timeSpentTotal.error,
            "Unable to load time spent, so members aren't sorted by it.",
          )}
        </p>
      )}
      {tagMutationError && (
        <div className="w-full">
          <p className="text-sm text-red-500">{tagMutationError}</p>
        </div>
      )}
      {viewMode === "cards" ? (
        <div className="w-full flex flex-col gap-y-4">
          <div className="grid gap-3 w-full [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
            {visibleCardUsers.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                tags={userTagsMap[user.id] || []}
                allTags={tags}
                onToggleTag={(tagId, nextChecked) =>
                  handleUserTagToggle(user.id, tagId, nextChecked)
                }
                isTagPending={(tagId) =>
                  pendingTagOps.has(`${user.id}-${tagId}`)
                }
                actions={actionSummaries}
                maxActionsPerWeek={maxActionsPerWeek}
                actionRelations={userActionRelations[user.id] || []}
              />
            ))}
          </div>
          {cardTotalPages > 1 && (
            <div className="flex flex-row items-center justify-between">
              <p className="text-sm text-zinc-500">
                {withCount(displayedUsers.length, "member")}
              </p>
              <Pagination
                page={currentCardPage}
                totalPages={cardTotalPages}
                onPageChange={setCardPage}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="w-full">
          <CommunityMembersTable
            leaders={[]}
            members={displayedProfiles}
            amLeader={true}
            memberHref={(id) =>
              href("/member/:userId", { userId: id.toString() })
            }
            userActionRelations={userActionRelations}
            memberContactInfo={memberContactInfo}
            actions={actionSummaries}
            maxActionsPerWeek={maxActionsPerWeek}
            completedAllCurrentActions={completedAllCurrentActions}
            showInfoTooltip
            showContractFilter
            disableSort={shuffledIds != null}
            pageSize={MEMBERS_PER_PAGE}
          />
        </div>
      )}
    </div>
  );
};

export default UsersList;
