import { UserDto } from "@alliance/shared/client/types.gen";

export enum RoleFilter {
  Admin = "admin",
  Staff = "staff",
}

export const ROLE_FILTERS: Record<
  RoleFilter,
  { label: string; matches: (user: UserDto) => boolean }
> = {
  [RoleFilter.Admin]: { label: "Admin", matches: (user) => user.admin },
  [RoleFilter.Staff]: { label: "Staff", matches: (user) => user.staff },
};

export function matchesSelectedRoles(params: {
  user: UserDto;
  selectedRoles: readonly RoleFilter[];
}): boolean {
  const { user, selectedRoles } = params;
  if (selectedRoles.length === 0) return true;
  return selectedRoles.some((role) => ROLE_FILTERS[role].matches(user));
}
