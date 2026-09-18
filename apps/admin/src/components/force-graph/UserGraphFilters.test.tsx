import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { community, tag, user } from "./graphTesting";
import {
  UserGraphFilterControls,
  useUserGraphFilters,
} from "./UserGraphFilters";

afterEach(cleanup);

const oakland = community(7, "Oakland");
const donor = tag("tag-donor", "Donor");

const USERS = [
  user({ id: 1, name: "ada", admin: true }),
  user({ id: 2, name: "sam", staff: true, communities: [oakland] }),
  user({ id: 3, name: "ren", admin: true, staff: true, tags: [donor] }),
  user({ id: 4, name: "lee", communities: [oakland], tags: [donor] }),
];

const Harness = () => {
  const filters = useUserGraphFilters(USERS);
  return (
    <>
      <UserGraphFilterControls filters={filters} />
      <output>
        {USERS.filter(filters.matches)
          .map((u) => u.name)
          .join(",")}
      </output>
      <span data-testid="active">{String(filters.isActive)}</span>
      <button type="button" onClick={filters.clear}>
        clear
      </button>
    </>
  );
};

const choose = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { exact: false }), {
    target: { value },
  });
const matching = () => screen.getByRole("status").textContent;

it("matches everyone until a filter is chosen", () => {
  render(<Harness />);

  expect(matching()).toBe("ada,sam,ren,lee");
  expect(screen.getByTestId("active").textContent).toBe("false");
});

it.each([
  ["admin", "ada,ren"],
  ["staff", "sam,ren"],
  ["regular", "lee"],
])("filters by role %s", (role, expected) => {
  render(<Harness />);

  choose("Role", role);

  expect(matching()).toBe(expected);
  expect(screen.getByTestId("active").textContent).toBe("true");
});

it("filters by community and tag together", () => {
  render(<Harness />);

  choose("Community", String(oakland.id));
  expect(matching()).toBe("sam,lee");

  choose("Tag", donor.id);
  expect(matching()).toBe("lee");
});

it("lists the communities and tags the users have", () => {
  render(<Harness />);

  expect(screen.getByRole("option", { name: "Oakland" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "Donor" })).toBeTruthy();
});

it("clears every filter", () => {
  render(<Harness />);
  choose("Role", "admin");
  choose("Tag", donor.id);

  fireEvent.click(screen.getByRole("button", { name: "clear" }));

  expect(matching()).toBe("ada,sam,ren,lee");
  expect(screen.getByTestId("active").textContent).toBe("false");
});
