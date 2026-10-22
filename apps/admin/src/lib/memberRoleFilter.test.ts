import { UserDto } from "@alliance/shared/client/types.gen";
import { matchesSelectedRoles, RoleFilter } from "./memberRoleFilter";
import { FORM_BUILDER_PREVIEW_USER } from "./testData";

const member = (overrides: Partial<UserDto>): UserDto => ({
  ...FORM_BUILDER_PREVIEW_USER,
  ...overrides,
});

const ada = member({ id: 1, name: "ada", admin: true });
const sam = member({ id: 2, name: "sam", staff: true });
const ren = member({ id: 3, name: "ren", admin: true, staff: true });
const lee = member({ id: 4, name: "lee" });

const MEMBERS = [ada, sam, ren, lee];

const namesMatching = (selectedRoles: RoleFilter[]) =>
  MEMBERS.filter((user) => matchesSelectedRoles({ user, selectedRoles }))
    .map((user) => user.name)
    .join(",");

it("keeps everyone when no role is selected", () => {
  expect(namesMatching([])).toBe("ada,sam,ren,lee");
});

it.each([
  [[RoleFilter.Admin], "ada,ren"],
  [[RoleFilter.Staff], "sam,ren"],
])("filters by %o", (selectedRoles, expected) => {
  expect(namesMatching(selectedRoles)).toBe(expected);
});

it("unions the two rather than intersecting them", () => {
  expect(namesMatching([RoleFilter.Admin, RoleFilter.Staff])).toBe(
    "ada,sam,ren",
  );
});

it("does not depend on the order roles were selected", () => {
  expect(namesMatching([RoleFilter.Staff, RoleFilter.Admin])).toBe(
    namesMatching([RoleFilter.Admin, RoleFilter.Staff]),
  );
});
