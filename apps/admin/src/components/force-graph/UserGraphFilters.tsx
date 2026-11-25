import { UserDto } from "@alliance/shared/client";
import { useCallback, useMemo, useState } from "react";
import { Select } from "../../ui/Select";
import { Field } from "../../ui/templates/Form";
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

/** Role, community and tag selects, stacked to fill a graph's inspector. */
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
    <OptionsSelect
      label="Community"
      value={filters.communityFilter}
      onChange={filters.setCommunityFilter}
      options={filters.availableCommunities}
    />
    <OptionsSelect
      label="Tag"
      value={filters.tagFilter}
      onChange={filters.setTagFilter}
      options={filters.availableTags}
    />
  </>
);

const OptionsSelect = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
}) => (
  <Field label={label}>
    {(control) => (
      <Select
        {...control}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </Select>
    )}
  </Field>
);
