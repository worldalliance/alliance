import { UserDto } from "@alliance/shared/client";
import { useCallback, useMemo, useState } from "react";
import { EnumFilterSelect } from "./EnumFilterSelect";

export type UserFilterOption = {
  label: string;
  matches: (u: UserDto) => boolean;
};

enum RoleFilter {
  All = "all",
  Admin = "admin",
  Staff = "staff",
  Regular = "regular",
}

const ROLE_FILTERS: Record<RoleFilter, UserFilterOption> = {
  [RoleFilter.All]: { label: "All", matches: () => true },
  [RoleFilter.Admin]: { label: "Admin", matches: (u) => u.admin },
  [RoleFilter.Staff]: { label: "Staff", matches: (u) => u.staff },
  [RoleFilter.Regular]: {
    label: "Regular",
    matches: (u) => !u.admin && !u.staff,
  },
};

export function useUserGraphFilters(users: UserDto[]) {
  const [roleFilter, setRoleFilter] = useState(RoleFilter.All);
  const [communityFilter, setCommunityFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");

  const availableCommunities = useMemo(() => {
    const map = new Map<number, string>();
    for (const u of users) {
      for (const c of u.communities ?? []) {
        if (!map.has(c.id)) map.set(c.id, c.name);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id: String(id), name }));
  }, [users]);

  const availableTags = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) {
      for (const t of u.tags ?? []) {
        if (!map.has(t.id)) map.set(t.id, t.name);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [users]);

  const matches = useCallback(
    (u: UserDto): boolean => {
      if (!ROLE_FILTERS[roleFilter].matches(u)) return false;
      if (communityFilter !== "all") {
        const inCommunity = (u.communities ?? []).some(
          (c) => String(c.id) === communityFilter,
        );
        if (!inCommunity) return false;
      }
      if (tagFilter !== "all") {
        const hasTag = (u.tags ?? []).some((t) => t.id === tagFilter);
        if (!hasTag) return false;
      }
      return true;
    },
    [roleFilter, communityFilter, tagFilter],
  );

  const isActive =
    roleFilter !== RoleFilter.All ||
    communityFilter !== "all" ||
    tagFilter !== "all";

  const clear = useCallback(() => {
    setRoleFilter(RoleFilter.All);
    setCommunityFilter("all");
    setTagFilter("all");
  }, []);

  return {
    roleFilter,
    setRoleFilter,
    communityFilter,
    setCommunityFilter,
    tagFilter,
    setTagFilter,
    availableCommunities,
    availableTags,
    matches,
    isActive,
    clear,
  };
}

type UserGraphFilters = ReturnType<typeof useUserGraphFilters>;

export const UserGraphFilterControls = ({
  filters,
}: {
  filters: UserGraphFilters;
}) => (
  <>
    <EnumFilterSelect
      label="Role"
      values={RoleFilter}
      options={ROLE_FILTERS}
      value={filters.roleFilter}
      onChange={filters.setRoleFilter}
    />

    <label className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-gray-600">Community</span>
      <select
        value={filters.communityFilter}
        onChange={(e) => filters.setCommunityFilter(e.target.value)}
        className="rounded border border-gray-300 px-2 py-1 text-xs bg-white"
      >
        <option value="all">All</option>
        {filters.availableCommunities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>

    <label className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-gray-600">Tag</span>
      <select
        value={filters.tagFilter}
        onChange={(e) => filters.setTagFilter(e.target.value)}
        className="rounded border border-gray-300 px-2 py-1 text-xs bg-white"
      >
        <option value="all">All</option>
        {filters.availableTags.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  </>
);
