import {
  actionsActionRelations,
  analyticsGetTimeSpentPerUser,
  analyticsGetTimeSpentPerUserTotal,
  communityGetAllMemberContactInfoAdmin,
  userAddUserToTag,
  userGetTags,
  userList,
  userRemoveUserFromTag,
} from "@alliance/shared/client";
import {
  CommunityMemberContactInfoDto,
  ProfileDto,
  TagDto,
  TimeSpentForUserDto,
  UserActionRelationDetailDto,
  UserActionRelationsResponseDto,
  UserActionSummaryDto,
  UserDto,
} from "@alliance/shared/client/types.gen";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@alliance/shared/styles/util";
import UserCard from "../components/UserCard";
import { useOutsideClick } from "@alliance/sharedweb/lib/useOutsideClick";
import { href, Link, useSearchParams } from "react-router";
import { LayoutGrid, List, Shuffle } from "lucide-react";
import CommunityMembersTable from "@alliance/sharedweb/ui/CommunityMembersTable";
import { calculateCompletionData } from "@alliance/shared/lib/actionUtils";
import { useMaxActionsPerWeek } from "@alliance/sharedweb/ui/UserProgressPills";
import { shuffleWithSeed } from "@alliance/shared/forms/randomutils";

type ViewMode = "cards" | "rows";

const UsersList: React.FC = () => {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [timeSpentPerUserLast7, setTimeSpentPerUserLast7] = useState<
    TimeSpentForUserDto[]
  >([]);
  const [timeSpentPerUserTotal, setTimeSpentPerUserTotal] = useState<
    TimeSpentForUserDto[]
  >([]);
  const [tags, setTags] = useState<TagDto[]>([]);
  const [actionSummaries, setActionSummaries] = useState<
    UserActionSummaryDto[]
  >([]);
  const [activeActions, setActiveActions] = useState<UserActionSummaryDto[]>(
    []
  );
  const [userActionRelations, setUserActionRelations] = useState<
    Record<number, UserActionRelationDetailDto[]>
  >({});
  const maxActionsPerWeek = useMaxActionsPerWeek({
    actionSummaries,
    userActionRelations,
  });
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
  const tagDropdownRef = useOutsideClick(() => setIsTagFilterOpen(false));
  const [pendingTagOps, setPendingTagOps] = useState<Set<string>>(
    () => new Set()
  );
  const [tagMutationError, setTagMutationError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [params, setParams] = useSearchParams();
  const viewMode = (params.get("viewMode") as ViewMode | undefined) ?? "rows";

  const [shuffledIds, setShuffledIds] = useState<number[] | null>(null);

  useEffect(() => {
    analyticsGetTimeSpentPerUser().then((res) => {
      if (res.data) {
        setTimeSpentPerUserLast7(res.data);
      }
    });
    analyticsGetTimeSpentPerUserTotal().then((res) => {
      if (res.data) {
        setTimeSpentPerUserTotal(res.data);
      }
    });
  }, []);

  useEffect(() => {
    userList().then((res) => setUsers(res.data || []));
  }, []);

  useEffect(() => {
    userGetTags().then((res) => setTags(res.data || []));
  }, []);

  useEffect(() => {
    actionsActionRelations().then((res) => {
      const data: UserActionRelationsResponseDto | undefined = res.data;
      if (!data) {
        return;
      }

      // latest on the right
      data.actions.reverse();

      setActionSummaries(data.actions);
      setActiveActions(
        data.actions.filter((action) => action.status === "member_action")
      );
      const relationMap: Record<number, UserActionRelationDetailDto[]> = {};
      for (const entry of data.users ?? []) {
        relationMap[entry.userId] = entry.relations ?? [];
      }
      setUserActionRelations(relationMap);
    });
  }, []);

  const userToTimeSpent = useMemo(() => {
    return timeSpentPerUserLast7.reduce((acc, time) => {
      acc[time.userId] = time.timeSpent;
      return acc;
    }, {} as Record<number, number>);
  }, [timeSpentPerUserLast7]);

  const userToTimeSpentTotal = useMemo(() => {
    return timeSpentPerUserTotal.reduce((acc, time) => {
      acc[time.userId] = time.timeSpent;
      return acc;
    }, {} as Record<number, number>);
  }, [timeSpentPerUserTotal]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      return (
        (userToTimeSpentTotal[b.id] ?? 0) - (userToTimeSpentTotal[a.id] ?? 0)
      );
    });
  }, [users, userToTimeSpentTotal]);

  const userTagsMap = useMemo(() => {
    return tags.reduce((acc, tag) => {
      tag.users.forEach((profile) => {
        if (!acc[profile.id]) {
          acc[profile.id] = [];
        }
        acc[profile.id].push(tag);
      });
      return acc;
    }, {} as Record<number, TagDto[]>);
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
    return filteredByTags.filter((user) => {
      const name = user.name?.toLowerCase() ?? "";
      const email = user.email?.toLowerCase() ?? "";
      return name.includes(query) || email.includes(query);
    });
  }, [filteredByTags, searchQuery]);

  const handleShuffle = useCallback(() => {
    const current = filteredBySearch;

    const seed = Math.random().toString(36).substring(2, 15);
    setShuffledIds(
      shuffleWithSeed(
        current.map((u) => u.id),
        seed
      )
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
    if (selectedTagIds.length === 1) {
      return selectedTagNames[0] ?? "1 tag";
    }
    return `${selectedTagIds.length} tags`;
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
      const lastEvent = user.contractEvents?.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      return {
        id: user.id,
        admin: user.admin,
        staff: user.staff,
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

  const [memberContactInfo, setMemberContactInfo] = useState<
    Record<number, CommunityMemberContactInfoDto>
  >({});

  useEffect(() => {
    communityGetAllMemberContactInfoAdmin().then((resp) => {
      if (resp.data) {
        setMemberContactInfo(
          resp.data.reduce((acc, contactInfo) => {
            acc[contactInfo.id] = contactInfo;
            return acc;
          }, {} as Record<number, CommunityMemberContactInfoDto>)
        );
      }
    });
  }, []);



  const updateTagInState = useCallback((updatedTag: TagDto) => {
    setTags((prev) => {
      const tagExists = prev.some((tag) => tag.id === updatedTag.id);
      if (tagExists) {
        return prev.map((tag) => (tag.id === updatedTag.id ? updatedTag : tag));
      }
      return [...prev, updatedTag];
    });
  }, []);

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
        if (nextChecked) {
          const res = await userAddUserToTag({
            path: { tagId },
            body: { userId },
          });
          if (res.data) {
            updateTagInState(res.data);
          }
        } else {
          const res = await userRemoveUserFromTag({
            path: { tagId },
            body: { userId },
          });
          if (res.data) {
            updateTagInState(res.data);
          }
        }
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
    [updateTagInState]
  );

  return (
    <div className="h-full p-5 flex flex-col items-center gap-y-3 overflow-x-hidden bg-zinc-50">
      <div className="flex flex-row gap-3 w-full items-center">
        <input
          type="text"
          autoFocus
          placeholder="Search by name or email..."
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
                              {memberCount} member{memberCount === 1 ? "" : "s"}
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
              viewMode === "rows" ? "bg-zinc-200" : "hover:bg-zinc-100"
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
              viewMode === "cards" ? "bg-zinc-200" : "hover:bg-zinc-100"
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
        <div className="grid gap-3 w-full [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
          {displayedUsers.map((user) => (
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
              isTagPending={(tagId) => pendingTagOps.has(`${user.id}-${tagId}`)}
              actions={actionSummaries}
              maxActionsPerWeek={maxActionsPerWeek}
              actionRelations={userActionRelations[user.id] || []}
            />
          ))}
        </div>
      ) : (
        <div className="w-full">
          <CommunityMembersTable
            leaders={[]}
            members={displayedProfiles}
            amLeader={true}
            userActionRelations={userActionRelations}
            memberContactInfo={memberContactInfo}
            actions={actionSummaries}
            maxActionsPerWeek={maxActionsPerWeek}
            completedAllCurrentActions={completedAllCurrentActions}
            showInfoTooltip
            showContractFilter
          />
        </div>
      )}
    </div>
  );
};

export default UsersList;
