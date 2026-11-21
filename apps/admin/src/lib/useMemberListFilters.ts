import type { TagDto, UserDto } from "@alliance/shared/client/types.gen";
import {
  CONTRACT_STATUS_LABEL,
  ContractStatus,
  contractStatus,
} from "@alliance/shared/lib/contract";
import { countBy } from "es-toolkit";
import { useMemo } from "react";
import { type FilterDefinition, FilterKind } from "../components/ui/FilterBar";
import {
  matchesSelectedRoles,
  ROLE_FILTERS,
  RoleFilter,
} from "./memberRoleFilter";
import { memberSearchMatcher } from "./memberSearch";
import { readSetParam, writeSetParam } from "./setSearchParam";
import { useSearchParam } from "./useSearchParam";

export enum MemberProgress {
  CaughtUp = "caught-up",
  NotCaughtUp = "not-caught-up",
}

const PROGRESS_LABEL: Record<MemberProgress, string> = {
  [MemberProgress.CaughtUp]: "Caught up",
  [MemberProgress.NotCaughtUp]: "Not caught up",
};

const ROLES = Object.values(RoleFilter);
const CONTRACT_STATUSES = Object.values(ContractStatus);
const DEFAULT_CONTRACT_STATUSES = [ContractStatus.Signed];
const PROGRESSES = Object.values(MemberProgress);

/**
 * The members list's search and filters, kept in the URL, and the members
 * they leave. Only signed members show until the contract filter changes.
 */
export function useMemberListFilters(params: {
  users: UserDto[];
  tags: TagDto[];
  tagsLoading: boolean;
  tagsFailed: boolean;
  completedAllCurrentActions: Record<number, boolean>;
  progressLoading: boolean;
  progressFailed: boolean;
}) {
  const {
    users,
    tags,
    tagsLoading,
    tagsFailed,
    completedAllCurrentActions,
    progressLoading,
    progressFailed,
  } = params;
  const [query, setQuery] = useSearchParam("q");
  const [roleParam, setRoleParam] = useSearchParam("role");
  const [tagParam, setTagParam] = useSearchParam("tag");
  const [contractParam, setContractParam] = useSearchParam("contract");
  const [progressParam, setProgressParam] = useSearchParam("progress");

  const tagIds = useMemo(() => tags.map((tag) => tag.id), [tags]);
  const roles = useMemo(
    () => readSetParam({ param: roleParam, values: ROLES, defaults: [] }),
    [roleParam],
  );
  const selectedTags = useMemo(
    () => new Set(tagParam?.split(",") ?? []),
    [tagParam],
  );
  const unknownTags = [...selectedTags].filter((id) => !tagIds.includes(id));
  const unknownTagLabel = tagsLoading
    ? "Loading…"
    : tagsFailed
      ? "Unavailable"
      : "Unknown tag";
  const contracts = useMemo(
    () =>
      readSetParam({
        param: contractParam,
        values: CONTRACT_STATUSES,
        defaults: DEFAULT_CONTRACT_STATUSES,
      }),
    [contractParam],
  );
  const progresses = useMemo(
    () =>
      readSetParam({
        param: progressParam,
        values: PROGRESSES,
        defaults: PROGRESSES,
      }),
    [progressParam],
  );

  const tagIdsByUser = useMemo(() => {
    const byUser = new Map<number, Set<string>>();
    for (const tag of tags) {
      for (const profile of tag.users) {
        const ids = byUser.get(profile.id) ?? new Set();
        ids.add(tag.id);
        byUser.set(profile.id, ids);
      }
    }
    return byUser;
  }, [tags]);

  const { contractCounts, progressCounts, shown } = useMemo(() => {
    const progressOf = (user: UserDto) =>
      completedAllCurrentActions[user.id]
        ? MemberProgress.CaughtUp
        : MemberProgress.NotCaughtUp;
    const matchesSearch = memberSearchMatcher(query ?? "");
    const narrowed = users.filter(
      (user) =>
        matchesSelectedRoles({ user, selectedRoles: [...roles] }) &&
        (tagsFailed ||
          selectedTags.size === 0 ||
          [...(tagIdsByUser.get(user.id) ?? [])].some((id) =>
            selectedTags.has(id),
          )) &&
        matchesSearch(user),
    );
    const signedAsChosen = narrowed.filter((user) =>
      contracts.has(contractStatus(user.lastContractEvent)),
    );
    return {
      contractCounts: countBy(narrowed, (user) =>
        contractStatus(user.lastContractEvent),
      ),
      progressCounts: countBy(signedAsChosen, progressOf),
      shown: progressFailed
        ? signedAsChosen
        : signedAsChosen.filter((user) => progresses.has(progressOf(user))),
    };
  }, [
    users,
    query,
    roles,
    tagsFailed,
    selectedTags,
    tagIdsByUser,
    contracts,
    progresses,
    progressFailed,
    completedAllCurrentActions,
  ]);

  const filters: FilterDefinition[] = [
    {
      kind: FilterKind.AnyOf,
      key: "role",
      label: "Role",
      options: ROLES.map((role) => ({
        value: role,
        label: ROLE_FILTERS[role].label,
        count: users.filter(ROLE_FILTERS[role].matches).length,
      })),
      selected: roles,
      defaultSelected: new Set(),
      onChange: (selected) =>
        setRoleParam(writeSetParam({ selected, values: ROLES, defaults: [] })),
    },
    ...(tags.length > 0 || selectedTags.size > 0
      ? [
          {
            kind: FilterKind.AnyOf,
            key: "tag",
            label: "Tag",
            options: [
              ...tags.map((tag) => ({
                value: tag.id,
                label: tag.name,
                count: tag.users.length,
              })),
              ...unknownTags.map((id) => ({
                value: id,
                label: `${unknownTagLabel} (${id})`,
                count: 0,
              })),
            ],
            selected: selectedTags,
            defaultSelected: new Set(),
            onChange: (selected: Set<string>) =>
              setTagParam(
                writeSetParam({
                  selected,
                  values: [...tagIds, ...unknownTags],
                  defaults: [],
                }),
              ),
          } satisfies FilterDefinition,
        ]
      : []),
    {
      kind: FilterKind.Options,
      key: "contract",
      label: "Contract",
      options: CONTRACT_STATUSES.map((status) => ({
        value: status,
        label: CONTRACT_STATUS_LABEL[status],
        count: contractCounts[status] ?? 0,
      })),
      selected: contracts,
      defaultSelected: new Set(DEFAULT_CONTRACT_STATUSES),
      onChange: (selected) =>
        setContractParam(
          writeSetParam({
            selected,
            values: CONTRACT_STATUSES,
            defaults: DEFAULT_CONTRACT_STATUSES,
          }),
        ),
    },
    ...(progressFailed && progressParam === null
      ? []
      : [
          {
            kind: FilterKind.Options,
            key: "progress",
            label: "Actions",
            options: PROGRESSES.map((progress) => ({
              value: progress,
              label: PROGRESS_LABEL[progress],
              count:
                progressLoading || progressFailed
                  ? undefined
                  : (progressCounts[progress] ?? 0),
            })),
            selected: progresses,
            defaultSelected: new Set(PROGRESSES),
            onChange: (selected: Set<string>) =>
              setProgressParam(
                writeSetParam({
                  selected,
                  values: PROGRESSES,
                  defaults: PROGRESSES,
                }),
              ),
          } satisfies FilterDefinition,
        ]),
  ];

  return {
    search: {
      label: "Search by name, email or phone",
      value: query ?? "",
      onChange: (value: string) => setQuery(value === "" ? null : value),
    },
    filters,
    shown,
    /** The URL names tags or action progress not loaded yet, so `shown` isn't final. */
    waiting:
      (tagParam !== null && tagsLoading) ||
      (progressParam !== null && progressLoading),
    /** Changes whenever the search or a filter does. */
    filterKey: [query, roleParam, tagParam, contractParam, progressParam].join(
      "|",
    ),
  };
}
