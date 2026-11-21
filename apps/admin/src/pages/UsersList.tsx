import { withCount } from "@alliance/common/plural";
import {
  ProfileDto,
  UserActionRelationDetailDto,
  UserDto,
} from "@alliance/shared/client/types.gen";
import { shuffleWithSeed } from "@alliance/shared/forms/randomutils";
import CommunityMembersTable from "@alliance/sharedweb/ui/CommunityMembersTable";
import Pagination from "@alliance/sharedweb/ui/Pagination";
import {
  ActionHistoryLegend,
  useMaxActionsPerWeek,
} from "@alliance/sharedweb/ui/UserProgressPills";
import { groupBy, mapValues } from "es-toolkit";
import { Shuffle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { href, Link } from "react-router";
import { secondaryButtonClass } from "../components/ui/controlStyles";
import FilterBar from "../components/ui/FilterBar";
import PageShell, { PageWidth } from "../components/ui/PageShell";
import SegmentedControl from "../components/ui/SegmentedControl";
import UserCard from "../components/UserCard";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { useActionRelationsAdmin } from "../lib/useActionRelationsAdmin";
import { useCompletedAllActiveActions } from "../lib/useCompletedAllActiveActions";
import { useMemberContactInfoAdmin } from "../lib/useMemberContactInfoAdmin";
import { useMemberListFilters } from "../lib/useMemberListFilters";
import { useSearchParam } from "../lib/useSearchParam";
import { useTagsAdmin } from "../lib/useTagsAdmin";
import { useTimeSpentPerUserTotalAdmin } from "../lib/useTimeSpentPerUserTotalAdmin";
import { useUsersAdmin } from "../lib/useUsersAdmin";

export enum MembersView {
  List = "list",
  Grid = "grid",
}

const VIEW_OPTIONS = [
  { value: MembersView.List, label: "List" },
  { value: MembersView.Grid, label: "Grid" },
] as const;

const MEMBERS_PER_PAGE = 50;
const NO_TIMES: Record<number, number> = {};

const toProfile = (user: UserDto): ProfileDto => ({
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
});

const UsersList: React.FC = () => {
  const usersQuery = useUsersAdmin();
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const timeSpentTotal = useTimeSpentPerUserTotalAdmin();
  const userToTimeSpentTotal = timeSpentTotal.data ?? NO_TIMES;
  const {
    tags,
    isLoading: tagsLoading,
    isLoadingError: tagsFailed,
    addUserToTag,
    removeUserFromTag,
  } = useTagsAdmin();
  const {
    data: relationsResponse,
    isPending: relationsLoading,
    isLoadingError: relationsFailed,
  } = useActionRelationsAdmin();
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
  const completedAllCurrentActions = useCompletedAllActiveActions({
    actionSummaries,
    userActionRelations,
  });
  const [pendingTagOps, setPendingTagOps] = useState<Set<string>>(
    () => new Set(),
  );
  const [tagMutationError, setTagMutationError] = useState<string | null>(null);

  const [viewParam, setView] = useSearchParam("view");
  const view =
    viewParam === MembersView.Grid ? MembersView.Grid : MembersView.List;

  const sortedUsers = useMemo(
    () =>
      [...users].sort(
        (a, b) =>
          (userToTimeSpentTotal[b.id] ?? 0) - (userToTimeSpentTotal[a.id] ?? 0),
      ),
    [users, userToTimeSpentTotal],
  );

  const { search, filters, shown, waiting, filterKey } = useMemberListFilters({
    users: sortedUsers,
    tags,
    tagsLoading,
    tagsFailed,
    completedAllCurrentActions,
    progressLoading: relationsLoading,
    progressFailed: relationsFailed,
  });

  const userTagsMap = useMemo(() => {
    const userTags = tags.flatMap((tag) =>
      tag.users.map((profile) => ({ userId: profile.id, tag })),
    );
    return mapValues(
      groupBy(userTags, (entry) => entry.userId),
      (entries) => entries.map((entry) => entry.tag),
    );
  }, [tags]);

  const [shuffledIds, setShuffledIds] = useState<number[] | null>(null);
  const handleShuffle = () => {
    const seed = Math.random().toString(36).substring(2, 15);
    setShuffledIds(
      shuffleWithSeed(
        shown.map((u) => u.id),
        seed,
      ),
    );
  };
  useEffect(() => {
    setShuffledIds(null);
  }, [filterKey]);

  const displayedUsers = useMemo(() => {
    if (
      shuffledIds != null &&
      shuffledIds.length === shown.length &&
      shown.every((u) => shuffledIds.includes(u.id))
    ) {
      const byId = Object.fromEntries(shown.map((u) => [u.id, u]));
      return shuffledIds.map((id) => byId[id]).filter(Boolean);
    }
    return shown;
  }, [shown, shuffledIds]);

  const [cardPage, setCardPage] = useState(1);
  // New search/filter/shuffle → back to the first page. Keyed on the filter
  // inputs, not the derived array: a background refetch that only changes
  // user fields must not yank the viewer back to the first page.
  useEffect(() => {
    setCardPage(1);
  }, [filterKey, shuffledIds]);

  const cardTotalPages = Math.max(
    1,
    Math.ceil(displayedUsers.length / MEMBERS_PER_PAGE),
  );
  const currentCardPage = Math.min(cardPage, cardTotalPages);

  const visibleCardUsers = displayedUsers.slice(
    (currentCardPage - 1) * MEMBERS_PER_PAGE,
    currentCardPage * MEMBERS_PER_PAGE,
  );

  const displayedProfiles = useMemo(
    () => displayedUsers.map(toProfile),
    [displayedUsers],
  );

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

  const body = () => {
    if (usersQuery.isPending || waiting) {
      return (
        <p role="status" className="text-sm text-zinc-600">
          Loading members…
        </p>
      );
    }
    if (usersQuery.isLoadingError) {
      return (
        <p role="alert" className="text-sm text-red-600">
          {adminRefusalMessage(
            usersQuery.error,
            "Couldn't load members. Reload to try again.",
          )}
        </p>
      );
    }
    if (users.length === 0) {
      return <p className="text-sm text-zinc-600">No members yet.</p>;
    }
    if (displayedUsers.length === 0) {
      return (
        <p className="text-sm text-zinc-600">No members match these filters.</p>
      );
    }
    switch (view) {
      case MembersView.Grid:
        return (
          <div className="flex flex-col gap-y-4">
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
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
        );
      case MembersView.List:
        return (
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
            showMembersHeading={false}
            disableSort={shuffledIds != null}
            pageSize={MEMBERS_PER_PAGE}
          />
        );
      default:
        throw new Error(`unknown view: ${view satisfies never}`);
    }
  };

  return (
    <PageShell
      title="Members"
      meta={
        usersQuery.data &&
        !waiting && (
          <span className="text-sm tabular-nums text-zinc-500">
            {displayedUsers.length === users.length
              ? users.length.toLocaleString()
              : `${displayedUsers.length.toLocaleString()} of ${users.length.toLocaleString()}`}
          </span>
        )
      }
      width={PageWidth.Full}
      actions={
        <Link to={href("/members/tags")} className={secondaryButtonClass}>
          Manage tags
        </Link>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <FilterBar search={search} filters={filters} />
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleShuffle}
              className={secondaryButtonClass}
            >
              <Shuffle size={14} aria-hidden />
              Shuffle order
            </button>
            <SegmentedControl
              label="View"
              options={VIEW_OPTIONS}
              value={view}
              onChange={(next) =>
                setView(next === MembersView.List ? null : next)
              }
            />
          </div>
        </div>
        <ActionHistoryLegend />
        {timeSpentTotal.isLoadingError && (
          <p role="alert" className="text-sm text-red-600">
            {adminRefusalMessage(
              timeSpentTotal.error,
              "Unable to load time spent, so members aren't sorted by it.",
            )}
          </p>
        )}
        {tagsFailed && (
          <p role="alert" className="text-sm text-red-600">
            Couldn&apos;t load tags, so members show without them and can&apos;t
            be filtered by tag. Reload to try again.
          </p>
        )}
        {relationsFailed && (
          <p role="alert" className="text-sm text-red-600">
            Couldn&apos;t load action progress, so members show without their
            action history and can&apos;t be filtered by it. Reload to try
            again.
          </p>
        )}
        {tagMutationError && (
          <p role="alert" className="text-sm text-red-600">
            {tagMutationError}
          </p>
        )}
        {body()}
      </div>
    </PageShell>
  );
};

export default UsersList;
