import type {
  TagDto,
  UserActionRelationDetailDto,
  UserDto,
} from "@alliance/shared/client/types.gen";
import { shuffleWithSeed } from "@alliance/shared/forms/randomutils";
import type { UseQueryResult } from "@tanstack/react-query";
import { mapValues } from "es-toolkit";
import { Shuffle } from "lucide-react";
import { useMemo } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf, formatCount } from "../../lib/formatNumber";
import {
  matchesSelectedRoles,
  ROLE_FILTERS,
  RoleFilter,
} from "../../lib/memberRoleFilter";
import { memberSearchMatcher } from "../../lib/memberSearch";
import { useActionRelationsAdmin } from "../../lib/useActionRelationsAdmin";
import { useMemberContactInfoAdmin } from "../../lib/useMemberContactInfoAdmin";
import { useTagsAdmin } from "../../lib/useTagsAdmin";
import { useTimeSpentPerUserTotalAdmin } from "../../lib/useTimeSpentPerUserTotalAdmin";
import Badge from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import { MultiFilter } from "../../ui/MultiFilter";
import Pagination from "../../ui/Pagination";
import { personName } from "../../ui/PersonCell";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import {
  FilterBar,
  ListContent,
  listCount,
  ListFooter,
  SearchField,
} from "../../ui/templates/List";
import { Fact } from "../../ui/templates/Record";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { MemberProgressTable } from "./MemberProgressTable";
import { useReportRowIds } from "./memberSteps";
import { ProgressFilters } from "./ProgressFilters";
import {
  byNextTaskDue,
  CompletionFilter,
  CONTRACT_FILTER_LABELS,
  ContractFilter,
  contractOf,
  filterByProgress,
  useMemberProgress,
} from "./progressRules";
import { TagsEditor } from "./TagsEditor";
import { hasActiveFilters, usePeopleFilters } from "./usePeopleFilters";
import { useTagMembership } from "./useTagMembership";

export const MEMBERS_PER_PAGE = 50;

const NO_USERS: UserDto[] = [];
const NO_TAGS: TagDto[] = [];

/** Every member with their task progress: search, filter, shuffle, tag, open. */
export function AllTab({
  users,
  onOpenMember,
  onRowIds,
}: {
  users: UseQueryResult<UserDto[]>;
  onOpenMember?: (userId: number) => void;
  /** The shown members' ids, in order, for the peek's up and down. */
  onRowIds?: (ids: readonly number[]) => void;
}) {
  const all = users.data ?? NO_USERS;
  const timeSpent = useTimeSpentPerUserTotalAdmin();
  const tagsAdmin = useTagsAdmin();
  const membership = useTagMembership(tagsAdmin);
  const relations = useActionRelationsAdmin();
  const contact = useMemberContactInfoAdmin();
  const {
    filters,
    setQ,
    setRoles,
    setTagIds,
    setContract,
    setCompletion,
    shuffle,
    setPage,
    clearFilters,
  } = usePeopleFilters();

  // Latest on the right, as the pills run.
  const actions = useMemo(
    () => relations.data?.actions.slice().reverse(),
    [relations.data],
  );
  const userActionRelations = useMemo(() => {
    if (!relations.data) return null;
    const byUser: Record<number, UserActionRelationDetailDto[]> = {};
    for (const entry of relations.data.users) {
      byUser[entry.userId] = entry.relations ?? [];
    }
    return byUser;
  }, [relations.data]);
  const progress = useMemberProgress({ actions, userActionRelations });

  const tags =
    tagsAdmin.isLoading || tagsAdmin.isLoadingError ? null : tagsAdmin.tags;
  const tagsByUserId = useMemo(() => {
    const byUser: Record<number, TagDto[]> = {};
    for (const tag of tags ?? NO_TAGS) {
      for (const profile of tag.users) (byUser[profile.id] ??= []).push(tag);
    }
    return byUser;
  }, [tags]);
  const tagNamesByUserId = useMemo(
    () =>
      tags &&
      Object.fromEntries(
        Object.entries(tagsByUserId).map(([id, list]) => [
          id,
          list.map((tag) => tag.name),
        ]),
      ),
    [tags, tagsByUserId],
  );

  const listed = useMemo(() => {
    const times = timeSpent.data ?? {};
    // The tags filter is off while tags are unknown, as their banner says.
    const selectedTags = new Set(tags === null ? [] : filters.tagIds);
    const matches = memberSearchMatcher(filters.q);
    return [...all]
      .sort((a, b) => (times[b.id] ?? 0) - (times[a.id] ?? 0))
      .filter(
        (user) =>
          matchesSelectedRoles({ user, selectedRoles: filters.roles }) &&
          (selectedTags.size === 0 ||
            (tagsByUserId[user.id] ?? []).some((tag) =>
              selectedTags.has(tag.id),
            )) &&
          (filters.q.trim() === "" || matches(user)),
      )
      .map((user) => ({ ...user, groupLead: user.leaderOfIds.length > 0 }));
  }, [
    all,
    timeSpent.data,
    filters.roles,
    filters.tagIds,
    filters.q,
    tags,
    tagsByUserId,
  ]);

  const { byContract, byCompletion, rows } = useMemo(
    () =>
      filterByProgress({
        members: listed,
        contract: filters.contract,
        completion: progress.known ? filters.completion : CompletionFilter.Any,
        completedAllCurrentActions: progress.completedAllCurrentActions,
      }),
    [
      listed,
      filters.contract,
      filters.completion,
      progress.known,
      progress.completedAllCurrentActions,
    ],
  );
  const ordered = useMemo(() => {
    if (filters.shuffleSeed === null) {
      return byNextTaskDue({
        members: rows,
        progress,
        memberContactInfo: contact.data,
      });
    }
    return shuffleWithSeed(rows, filters.shuffleSeed);
  }, [rows, progress, contact.data, filters.shuffleSeed]);

  const totalPages = Math.max(1, Math.ceil(ordered.length / MEMBERS_PER_PAGE));
  const page = Math.min(filters.page, totalPages);
  const shown = ordered.slice(
    (page - 1) * MEMBERS_PER_PAGE,
    page * MEMBERS_PER_PAGE,
  );

  useReportRowIds(
    onRowIds,
    shown.map((member) => member.id),
  );

  const roleCounts = useMemo(
    () =>
      Object.values(RoleFilter).map((role) => ({
        value: role,
        label: ROLE_FILTERS[role].label,
        memberCount: users.data?.filter(ROLE_FILTERS[role].matches).length,
      })),
    [users.data],
  );
  const count = <K extends string>(lists: Record<K, unknown[]>) =>
    mapValues(lists, (list) => list.length);

  const filtered = hasActiveFilters(filters);
  // Rows wait for what orders and filters them, so they never move under a click.
  const orderPending =
    [relations, contact, timeSpent].some((query) => query.isPending) ||
    (filters.tagIds.length > 0 && tagsAdmin.isLoading);
  return (
    <>
      <PartBanners
        relations={relations}
        contact={contact}
        timeSpent={timeSpent}
        tagsAdmin={tagsAdmin}
      />
      {membership.error && (
        <Banner
          tone={BannerTone.Danger}
          action={
            <Button
              variant={ButtonVariant.Ghost}
              size="small"
              onClick={membership.dismissError}
            >
              Dismiss
            </Button>
          }
        >
          {membership.error}
        </Banner>
      )}
      <RefreshFailedBanner things="members" query={users} />
      <FilterBar
        count={listCount({
          shown: rows.length,
          total: all.length,
          noun: "member",
        })}
        actions={
          <Button
            variant={ButtonVariant.Default}
            size="small"
            onClick={shuffle}
            disabled={rows.length < 2}
          >
            <Shuffle aria-hidden="true" className="size-4" />
            Shuffle
          </Button>
        }
      >
        <SearchField
          label="Search by name, email or phone"
          className="w-72"
          value={filters.q}
          onChange={setQ}
        />
        <MultiFilter
          title="Roles"
          noun="role"
          options={roleCounts}
          selected={filters.roles}
          onChange={setRoles}
          emptyText="No roles"
        />
        <MultiFilter
          title="Tags"
          noun="tag"
          options={(tags ?? NO_TAGS).map((tag) => ({
            value: tag.id,
            label: tag.name,
            memberCount: tag.users.length,
          }))}
          selected={filters.tagIds}
          onChange={setTagIds}
          emptyText={tags ? "No tags yet" : "Tags haven't loaded"}
        />
        <ProgressFilters
          contract={filters.contract}
          onContractChange={setContract}
          completion={filters.completion}
          onCompletionChange={setCompletion}
          contractCounts={users.data ? count(byContract) : undefined}
          completionCounts={
            users.data && progress.known ? count(byCompletion) : undefined
          }
        />
        {/* Hidden, not unmounted, so setting a filter doesn't rewrap the bar. */}
        <Button
          variant={ButtonVariant.Ghost}
          size="small"
          className={filtered ? undefined : "invisible"}
          aria-hidden={!filtered}
          onClick={clearFilters}
        >
          Clear filters
        </Button>
      </FilterBar>
      <ListContent>
        <ContentState
          things="members"
          query={{ ...users, isPending: users.isPending || orderPending }}
          refreshBanner={false}
          skeleton={
            <TableSkeleton
              bleed
              columns={7}
              columnClassNames={[undefined, undefined, undefined, "text-right"]}
            />
          }
          empty={shown.length === 0}
          filtered={filtered}
          onClearFilters={clearFilters}
          emptyTitle={all.length === 0 ? "No members yet" : "No signed members"}
          emptyDescription={
            all.length > 0 &&
            "No member has a signed contract. The Contract filter shows the others."
          }
          emptyAction={
            all.length > 0 && (
              <Button
                variant={ButtonVariant.Default}
                onClick={() => setContract(ContractFilter.All)}
              >
                Show all members
              </Button>
            )
          }
        >
          <MemberProgressTable
            bleed
            members={shown}
            onOpenMember={onOpenMember}
            progress={progress}
            memberContactInfo={contact.data}
            tagNamesByUserId={tagNamesByUserId}
            detailFacts={(member) => {
              const name = personName({ userId: member.id, name: member.name });
              const memberTags = tagsByUserId[member.id] ?? NO_TAGS;
              return (
                <>
                  <Fact label="Contract">
                    {CONTRACT_FILTER_LABELS[contractOf(member)]}
                  </Fact>
                  <Fact label="Tags">
                    <span className="flex flex-wrap items-center gap-1 py-1.5">
                      {tags === null
                        ? "—"
                        : memberTags.map((tag) => (
                            <Badge key={tag.id}>{tag.name}</Badge>
                          ))}
                      {tags && (
                        <TagsEditor
                          userId={member.id}
                          memberName={name}
                          tags={tags}
                          memberTagIds={
                            new Set(memberTags.map((tag) => tag.id))
                          }
                          membership={membership}
                        />
                      )}
                    </span>
                  </Fact>
                </>
              );
            }}
          />
        </ContentState>
      </ListContent>
      {totalPages > 1 && (
        <ListFooter>
          <span className="tabular-nums">
            {formatCount((page - 1) * MEMBERS_PER_PAGE + 1)}–
            {formatCount((page - 1) * MEMBERS_PER_PAGE + shown.length)} of{" "}
            {countOf(ordered.length, "member")}
          </span>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </ListFooter>
      )}
    </>
  );
}

/**
 * A part the table reads that failed to load, named with what it leaves out.
 * The members list's own failure is the body's.
 */
function PartBanners({
  relations,
  contact,
  timeSpent,
  tagsAdmin,
}: {
  relations: ReturnType<typeof useActionRelationsAdmin>;
  contact: ReturnType<typeof useMemberContactInfoAdmin>;
  timeSpent: ReturnType<typeof useTimeSpentPerUserTotalAdmin>;
  tagsAdmin: ReturnType<typeof useTagsAdmin>;
}) {
  const reason = (error: unknown) =>
    adminRefusalMessage(error, LOAD_FAILED_FALLBACK);
  return (
    <>
      {relations.isLoadingError && (
        <Banner tone={BannerTone.Danger}>
          Couldn't load the members' task records. {reason(relations.error)}{" "}
          {`Task history and next task due show "—", the caught-up filter is off, and members aren't ordered by next task due.`}
        </Banner>
      )}
      {contact.isLoadingError && (
        <Banner tone={BannerTone.Danger}>
          Couldn't load contact details. {reason(contact.error)}{" "}
          {`Contact times and time away show "—".`}
        </Banner>
      )}
      {timeSpent.isLoadingError && (
        <Banner tone={BannerTone.Danger}>
          Couldn't load time spent. {reason(timeSpent.error)} Members with the
          same next task due and contact time aren't ordered by it.
        </Banner>
      )}
      {tagsAdmin.isLoadingError && (
        <Banner tone={BannerTone.Danger}>
          Couldn't load tags. {reason(tagsAdmin.error)} The tags filter and
          column are off until they load.
        </Banner>
      )}
    </>
  );
}
