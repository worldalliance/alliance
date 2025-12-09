import {
  analyticsGetTimeSpentPerUser,
  analyticsGetTimeSpentPerUserTotal,
  userAddUserToTag,
  userList,
  actionsActionRelations as userGetActionRelations,
  userRemoveUserFromTag,
  userGetTags,
} from "@alliance/shared/client";
import {
  TagDto,
  TimeSpentForUserDto,
  UserActionRelationDetailDto,
  UserActionRelationsResponseDto,
  UserActionSummaryDto,
  UserDto,
} from "@alliance/shared/client/types.gen";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import UserCard from "../components/UserCard";
import DropdownSelect from "@alliance/shared/ui/DropdownSelect";
import { useOutsideClick } from "@alliance/shared/lib/useOutsideClick";
import { href, Link } from "react-router";

const USER_FILTER_MODES = ["All", "Signed", "Suspended", "Not signed"] as const;
type UserFilterMode = (typeof USER_FILTER_MODES)[number];

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
  const [userActionRelations, setUserActionRelations] = useState<
    Record<number, UserActionRelationDetailDto[]>
  >({});
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [filterMode, setFilterMode] = useState<UserFilterMode>("All");
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
  const tagDropdownRef = useOutsideClick(() => setIsTagFilterOpen(false));
  const filterModeOptions = useMemo(() => Array.from(USER_FILTER_MODES), []);
  const [pendingTagOps, setPendingTagOps] = useState<Set<string>>(
    () => new Set()
  );
  const [tagMutationError, setTagMutationError] = useState<string | null>(null);

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
    userGetActionRelations().then((res) => {
      const data: UserActionRelationsResponseDto | undefined = res.data;
      if (!data) {
        return;
      }

      // latest on the right
      data.actions.reverse();

      setActionSummaries(data.actions ?? []);
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

  const modeToUsers = useMemo(() => {
    return USER_FILTER_MODES.reduce((acc, mode) => {
      acc[mode] = filteredByTags.filter((user) => {
        if (mode === "All") return true;
        const lastEvent = user.contractEvents.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0];
        if (mode === "Not signed") return user.contractEvents.length === 0;
        if (mode === "Signed") return lastEvent?.type === "signed";
        if (mode === "Suspended") return lastEvent?.type === "suspended";
      });
      return acc;
    }, {} as Record<UserFilterMode, UserDto[]>);
  }, [filteredByTags]);

  const selectedTagNames = useMemo(() => {
    if (!selectedTagIds.length) return [] as string[];
    const selected = new Set(selectedTagIds);
    return tags.filter((tag) => selected.has(tag.id)).map((tag) => tag.name);
  }, [tags, selectedTagIds]);

  const groupFilterLabel = useMemo(() => {
    if (!selectedTagIds.length) {
      return "All tags";
    }
    if (selectedTagIds.length === 1) {
      return selectedTagNames[0] ?? "1 tag";
    }
    return `${selectedTagIds.length} tags`;
  }, [selectedTagIds, selectedTagNames]);

  const toggleTagSelection = (tagId: number) => {
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

  const noteForLocalhost =
    typeof window !== "undefined" && window.location.href.includes("localhost");

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
    async (userId: number, tagId: number, nextChecked: boolean) => {
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
    <div className="h-full p-5 pt-20 flex flex-col items-center gap-y-3 overflow-x-hidden">
      <div className="flex flex-row gap-3 w-full items-center">
        <div className="flex flex-row gap-3 items-center">
          <DropdownSelect
            options={filterModeOptions}
            secondaryLabels={filterModeOptions.map((mode) =>
              (modeToUsers[mode as UserFilterMode]?.length ?? 0).toString()
            )}
            value={filterMode}
            onChange={(mode) => setFilterMode(mode as UserFilterMode)}
          />
          <div className="relative" ref={tagDropdownRef}>
            <button
              type="button"
              className="font-ibm text-sm border border-gray-2 text-black bg-white hover:bg-zinc-50 px-3 rounded-sm py-2 flex flex-row gap-x-2 items-center"
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
          <Link
            to={href("/members/tags")}
            className="text-sm text-blue-600 hover:underline"
          >
            Manage tags
          </Link>
          {noteForLocalhost && (
            <p className="text-sm text-gray-500">
              note: activity data is prod-only
            </p>
          )}
        </div>
      </div>
      {tagMutationError && (
        <div className="w-full">
          <p className="text-sm text-red-500">{tagMutationError}</p>
        </div>
      )}
      <div className="grid gap-3 w-full [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
        {(modeToUsers[filterMode] ?? []).map((user) => (
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
            actionRelations={userActionRelations[user.id] || []}
          />
        ))}
      </div>
    </div>
  );
};

export default UsersList;
