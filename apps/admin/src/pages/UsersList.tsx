import { phoneSearchDigits } from "@alliance/common/phone";
import { withCount } from "@alliance/common/plural";
import {
  actionsActionRelationsAdmin,
  analyticsGetTimeSpentPerUserAdmin,
  analyticsGetTimeSpentPerUserTotalAdmin,
  communityGetAllMemberContactInfoAdmin,
  userListAdmin,
} from "@alliance/shared/client";
import {
  CommunityMemberContactInfoDto,
  ProfileDto,
  UserActionRelationDetailDto,
} from "@alliance/shared/client/types.gen";
import { shuffleWithSeed } from "@alliance/shared/forms/randomutils";
import { calculateCompletionData } from "@alliance/shared/lib/actionUtils";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useTagsAdmin } from "@alliance/shared/lib/useTagsAdmin";
import { cn } from "@alliance/shared/styles/util";
import { useOutsideClick } from "@alliance/sharedweb/lib/useOutsideClick";
import CommunityMembersTable from "@alliance/sharedweb/ui/CommunityMembersTable";
import Pagination from "@alliance/sharedweb/ui/Pagination";
import { useMaxActionsPerWeek } from "@alliance/sharedweb/ui/UserProgressPills";
import { useQuery } from "@tanstack/react-query";
import { groupBy, mapValues } from "es-toolkit";
import { LayoutGrid, List, Shuffle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { href, Link, useSearchParams } from "react-router";
import UserCard from "../components/UserCard";

type ViewMode = "cards" | "rows";

const MEMBERS_PER_PAGE = 50;

const UsersList: React.FC = () => {
  const { data: users = [] } = useQuery({
    queryKey: queryKeys.usersAdmin(),
    queryFn: () =>
      userListAdmin({ throwOnError: true }).then((response) => response.data),
  });
  const { data: timeSpentPerUserLast7 = [] } = useQuery({
    queryKey: queryKeys.timeSpentPerUserAdmin(),
    queryFn: () =>
      analyticsGetTimeSpentPerUserAdmin({ throwOnError: true }).then(
        (response) => response.data,
      ),
  });
  const { data: timeSpentPerUserTotal = [] } = useQuery({
    queryKey: queryKeys.timeSpentPerUserTotalAdmin(),
    queryFn: () =>
      analyticsGetTimeSpentPerUserTotalAdmin({ throwOnError: true }).then(
        (response) => response.data,
      ),
  });
  const { tags, addUserToTag, removeUserFromTag } = useTagsAdmin();
  const { data: relationsResponse } = useQuery({
    queryKey: queryKeys.actionRelationsAdmin(),
    queryFn: () =>
      actionsActionRelationsAdmin({ throwOnError: true }).then(
        (response) => response.data,
      ),
  });
  // latest on the right
  const actionSummaries = useMemo(
    () => (relationsResponse?.actions ?? []).slice().reverse(),
    [relationsResponse],
  );
  const activeActions = useMemo(
    () => actionSummaries.filter((action) => action.status === "member_action"),
    [actionSummaries],
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
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
  const tagDropdownRef = useOutsideClick(() => setIsTagFilterOpen(false));
  const [pendingTagOps, setPendingTagOps] = useState<Set<string>>(
    () => new Set(),
  );
  const [tagMutationError, setTagMutationError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [params, setParams] = useSearchParams();
  const viewMode = (params.get("viewMode") as ViewMode | undefined) ?? "rows";

  const [shuffledIds, setShuffledIds] = useState<number[] | null>(null);

  const userToTimeSpent = useMemo(
    () =>
      Object.fromEntries(
        timeSpentPerUserLast7.map((time) => [time.userId, time.timeSpent]),
      ),
    [timeSpentPerUserLast7],
  );

  const userToTimeSpentTotal = useMemo(
    () =>
      Object.fromEntries(
        timeSpentPerUserTotal.map((time) => [time.userId, time.timeSpent]),
      ),
    [timeSpentPerUserTotal],
  );

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

  const filteredByTags = useMemo(() => {
    if (!selectedTagIds.length) {
      return sortedUsers;
    }
    const selected = new Set(selectedTagIds);
    return sortedUsers.filter((user) => {
      const userTags = userTagsMap[user.id] || [];
      return userTags.some((tag) => selected.has(tag.id));
    });
  }, [selectedTagIds, sortedUsers, userTagsMap]);

  const filteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) {
      return filteredByTags;
    }
    const query = searchQuery.toLowerCase().trim();
    const phoneQuery = phoneSearchDigits(query);
    return filteredByTags.filter((user) => {
      const name = user.name?.toLowerCase() ?? "";
      const email = user.email?.toLowerCase() ?? "";
      const phone = user.phoneNumber?.toLowerCase() ?? "";
      const normalizedPhone = phoneSearchDigits(user.phoneNumber);
      return (
        name.includes(query) ||
        email.includes(query) ||
        phone.includes(query) ||
        (phoneQuery !== "" && normalizedPhone.includes(phoneQuery))
      );
    });
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

  const selectedTagNames = useMemo(() => {
    if (!selectedTagIds.length) return [] as string[];
    const selected = new Set(selectedTagIds);
    return tags.filter((tag) => selected.has(tag.id)).map((tag) => tag.name);
  }, [tags, selectedTagIds]);

  useEffect(() => {
    setShuffledIds(null);
  }, [selectedTagIds, searchQuery]);

  const groupFilterLabel = useMemo(() => {
    if (!selectedTagIds.length) {
      return "All tags";
    }
    return (
      (selectedTagIds.length === 1 && selectedTagNames[0]) ||
      withCount(selectedTagIds.length, "tag")
    );
  }, [selectedTagIds, selectedTagNames]);

  const toggleTagSelection = (tagId: string) => {
    setSelectedTagIds((prev) => {
      if (prev.includes(tagId)) {
        return prev.filter((id) => id !== tagId);
      }
      return [...prev, tagId];
    });
  };

  const clearTagSelection = () => {
    setSelectedTagIds([]);
  };

  const resetAllFilters = () => {
    setSearchQuery("");
    setSelectedTagIds([]);
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" || selectedTagIds.length > 0;

  const usersAsProfiles = useMemo((): ProfileDto[] => {
    return filteredBySearch.map((user) => {
      const lastEvent = [...(user.contractEvents ?? [])].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      )[0];
      return {
        id: user.id,
        admin: user.admin,
        staff: user.staff,
        ambassador: user.ambassador,
        profilePicture: user.profilePicture,
        profileDescription: user.profileDescription,
        displayName: user.name,
        hasActiveContract: lastEvent?.type === "signed",
        isCommunityLeader: false,
        lastContractEvent: lastEvent,
        anonymous: user.anonymous,
      };
    });
  }, [filteredBySearch]);

  const { completedAllCurrentActions } = useMemo<{
    completedAllCurrentActions: Record<number, boolean>;
    nCompleted: number;
    nTotal: number;
  }>(() => {
    if (!userActionRelations) {
      return {
        completedAllCurrentActions: {} as Record<number, boolean>,
        nCompleted: 0,
        nTotal: 0,
      };
    }

    return calculateCompletionData({
      filteredActionIds: activeActions.map((a) => a.id),
      userActionRelations,
    });
  }, [activeActions, userActionRelations]);

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

  const { data: contactInfoList } = useQuery({
    queryKey: queryKeys.memberContactInfoAdmin(),
    queryFn: () =>
      communityGetAllMemberContactInfoAdmin({ throwOnError: true }).then(
        (response) => response.data,
      ),
  });
  const memberContactInfo = useMemo(
    () =>
      (contactInfoList ?? []).reduce(
        (acc, contactInfo) => {
          acc[contactInfo.id] = contactInfo;
          return acc;
        },
        {} as Record<number, CommunityMemberContactInfoDto>,
      ),
    [contactInfoList],
  );

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
    <div className="h-full p-5 flex flex-col items-center gap-y-3 overflow-x-hidden bg-zinc-50">
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
          <div className="relative" ref={tagDropdownRef}>
            <button
              type="button"
              className="text-sm border border-gray-2 text-black bg-white hover:bg-zinc-50 px-3 rounded-sm py-2 flex flex-row gap-x-2 items-center"
              style={{ fontWeight: 450 }}
              onClick={() => setIsTagFilterOpen((open) => !open)}
            >
              <span>{groupFilterLabel}</span>
            </button>
            {isTagFilterOpen && (
              <div className="absolute z-10 top-[calc(100%+4px)] left-0 min-w-[220px] bg-white border border-zinc-200 rounded shadow">
                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200">
                  <p className="text-sm font-medium text-zinc-600">Tags</p>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={clearTagSelection}
                  >
                    Clear
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {tags.length ? (
                    tags.map((tag) => {
                      const checked = selectedTagIds.includes(tag.id);
                      const memberCount = tag.users.length;
                      return (
                        <label
                          key={tag.id}
                          className="flex flex-row items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="cursor-pointer"
                            checked={checked}
                            onChange={() => toggleTagSelection(tag.id)}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">{tag.name}</span>
                            <span className="text-xs text-zinc-500">
                              {withCount(memberCount, "member")}
                            </span>
                          </div>
                        </label>
                      );
                    })
                  ) : (
                    <p className="px-3 py-2 text-sm text-zinc-500">
                      No tags yet
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
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
                timeSpent={userToTimeSpent[user.id]}
                timeSpentTotal={userToTimeSpentTotal[user.id]}
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
