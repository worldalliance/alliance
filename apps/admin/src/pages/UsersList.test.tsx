import type {
  ContractEventDto,
  TagDto,
  UserDto,
} from "@alliance/shared/client";
import {
  makeProfile,
  makeTag,
  makeUser,
} from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import UsersList from "./UsersList";

afterEach(cleanup);

const ada = makeUser({
  id: 1,
  name: "Ada",
  email: "first@example.com",
  admin: true,
});
const sam = makeUser({
  id: 2,
  name: "Sam",
  email: "sam@example.com",
  staff: true,
  phoneNumber: "+1 (555) 010-2000",
});
const lee = makeUser({
  id: 3,
  name: "Lee",
  email: "lee@example.org",
  staff: true,
});

let users: UserDto[] = [];
let tags: TagDto[] = [];
let addUserStatus = 200;
let timeSpentTotal: () => Response;
const tagCalls: { path: string; body: unknown }[] = [];

serveApi(
  routes({
    "GET /user/list": () => Response.json(users),
    "GET /analytics/time-spent-per-user-total": () => timeSpentTotal(),
    "GET /user/tags": () => Response.json(tags),
    "GET /actions/action-relations": () =>
      Response.json({ actions: [], suites: [], users: [] }),
    "GET /community/memberContactInfo": () => Response.json([]),
    "POST /user/tags/:tagId/addUser": async ({ request, params }) => {
      if (addUserStatus !== 200) {
        return Response.json({}, { status: addUserStatus });
      }
      tagCalls.push({
        path: `${params.tagId}/addUser`,
        body: await request.json(),
      });
      return Response.json({});
    },
    "POST /user/tags/:tagId/removeUser": async ({ request, params }) => {
      tagCalls.push({
        path: `${params.tagId}/removeUser`,
        body: await request.json(),
      });
      return Response.json({});
    },
  }),
);

beforeEach(() => {
  users = [ada, sam, lee];
  tags = [
    makeTag({ id: "t1", name: "Volunteers", users: [makeProfile(lee.id)] }),
    makeTag({ id: "t2", name: "Donors", users: [makeProfile(sam.id)] }),
  ];
  addUserStatus = 200;
  timeSpentTotal = () => Response.json([]);
  tagCalls.length = 0;
});

const renderPage = (viewMode = "cards") =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/members?viewMode=${viewMode}`]}>
        <UsersList />
      </MemoryRouter>
    </ToastProvider>,
    queryWrapper(),
  );

const shownNames = () =>
  screen
    .queryAllByRole("link")
    .map((link) => link.textContent)
    .filter((text) => users.some((user) => user.name === text));

const openFilter = (label: string) =>
  fireEvent.click(screen.getByRole("button", { name: label }));

const search = (query: string) =>
  fireEvent.change(
    screen.getByPlaceholderText("Search by name, email, or phone..."),
    { target: { value: query } },
  );

it("orders members by total time spent", async () => {
  timeSpentTotal = () =>
    Response.json([
      { userId: sam.id, timeSpent: 30 },
      { userId: lee.id, timeSpent: 90 },
    ]);

  renderPage();

  await waitFor(() => expect(shownNames()).toEqual(["Lee", "Sam", "Ada"]));
});

it("says members aren't sorted when time spent fails to load", async () => {
  timeSpentTotal = () => Response.json({}, { status: 500 });

  renderPage();

  expect(
    (
      await screen.findByText(
        "Unable to load time spent, so members aren't sorted by it.",
      )
    ).role,
  ).toBe("alert");
  expect(shownNames()).toEqual(["Ada", "Sam", "Lee"]);
});

it("filters by role and names the selection on the button", async () => {
  renderPage();
  await screen.findByText("Ada");
  openFilter("All roles");
  expect(
    screen.getByRole("checkbox", { name: /Admin.*1 member$/ }),
  ).toBeTruthy();
  expect(
    screen.getByRole("checkbox", { name: /Staff.*2 members$/ }),
  ).toBeTruthy();

  fireEvent.click(screen.getByRole("checkbox", { name: /Admin/ }));
  expect(shownNames()).toEqual(["Ada"]);
  expect(screen.getByRole("button", { name: "Admin" })).toBeTruthy();

  fireEvent.click(screen.getByRole("checkbox", { name: /Staff/ }));
  expect(shownNames()).toEqual(["Ada", "Sam", "Lee"]);
  expect(screen.getByRole("button", { name: "2 roles" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(shownNames()).toEqual(["Ada", "Sam", "Lee"]);
  expect(screen.getByRole("button", { name: "All roles" })).toBeTruthy();
});

it("filters by tag and names the selection on the button", async () => {
  renderPage();
  await screen.findByText("Ada");
  openFilter("All tags");

  fireEvent.click(screen.getByRole("checkbox", { name: /Volunteers/ }));
  expect(shownNames()).toEqual(["Lee"]);
  expect(screen.getByRole("button", { name: "Volunteers" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Reset filters" })).toBeTruthy();

  fireEvent.click(screen.getByRole("checkbox", { name: /Donors/ }));
  expect(shownNames()).toEqual(["Sam", "Lee"]);
  expect(screen.getByRole("button", { name: "2 tags" })).toBeTruthy();
});

it("says so when there are no tags to filter by", async () => {
  tags = [];
  renderPage();
  await screen.findByText("Ada");
  openFilter("All tags");
  expect(screen.getByText("No tags yet")).toBeTruthy();
});

it("searches by name, email, and phone digits", async () => {
  renderPage();
  await screen.findByText("Ada");

  search("ada");
  expect(shownNames()).toEqual(["Ada"]);
  search("example.org");
  expect(shownNames()).toEqual(["Lee"]);
  search("555 0102000");
  expect(shownNames()).toEqual(["Sam"]);
});

it("resets every filter at once", async () => {
  renderPage();
  await screen.findByText("Ada");
  expect(screen.queryByRole("button", { name: "Reset filters" })).toBeNull();

  openFilter("All roles");
  fireEvent.click(screen.getByRole("checkbox", { name: /Staff/ }));
  expect(screen.getByRole("button", { name: "Reset filters" })).toBeTruthy();
  search("lee");
  openFilter("All tags");
  fireEvent.click(screen.getByRole("checkbox", { name: /Volunteers/ }));
  expect(shownNames()).toEqual(["Lee"]);

  fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
  expect(shownNames()).toEqual(["Ada", "Sam", "Lee"]);
  expect(screen.getByRole("button", { name: "All roles" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "All tags" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Reset filters" })).toBeNull();
});

const cardOf = (name: HTMLElement) => {
  let card: HTMLElement | null = name;
  while (card && !within(card).queryByRole("button", { name: "Manage" })) {
    card = card.parentElement;
  }
  if (!card) throw new Error(`no card holds ${name.textContent}`);
  return card;
};

const toggleTagOnCard = async ({
  member,
  tagName,
}: {
  member: string;
  tagName: string;
}) => {
  renderPage();
  const card = cardOf(await screen.findByText(member));
  fireEvent.click(within(card).getByRole("button", { name: "Manage" }));
  fireEvent.click(
    within(card).getByRole("checkbox", { name: new RegExp(tagName) }),
  );
};

it("adds a member to a tag from their card", async () => {
  await toggleTagOnCard({ member: "Ada", tagName: "Donors" });
  await waitFor(() =>
    expect(tagCalls).toEqual([
      { path: "t2/addUser", body: { userId: ada.id } },
    ]),
  );
});

it("removes a member from a tag from their card", async () => {
  await toggleTagOnCard({ member: "Lee", tagName: "Volunteers" });
  await waitFor(() =>
    expect(tagCalls).toEqual([
      { path: "t1/removeUser", body: { userId: lee.id } },
    ]),
  );
});

it("shows an error when a tag change fails", async () => {
  addUserStatus = 500;
  const errors = jest.spyOn(console, "error").mockImplementation(() => {});
  await toggleTagOnCard({ member: "Ada", tagName: "Donors" });
  expect(
    await screen.findByText("Failed to update tag membership. Try again."),
  ).toBeTruthy();
  errors.mockRestore();
});

it("pages the cards and returns to the first page on a new search", async () => {
  users = Array.from({ length: 51 }, (_, index) =>
    makeUser({ id: index + 1, name: `Member ${index + 1}` }),
  );
  renderPage();
  await screen.findByText("Member 1");
  expect(screen.getByText("51 members")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "2" }));
  expect(shownNames()).toEqual(["Member 51"]);

  search("Member");
  expect(shownNames()).toHaveLength(50);
  expect(shownNames()[0]).toBe("Member 1");
});

it("lists the filtered members in the table", async () => {
  // The table shows only signed members until its contract filter changes.
  const signed: ContractEventDto = {
    type: "signed",
    date: "2026-01-01T00:00:00.000Z",
    automatic: false,
    contractId: null,
  };
  users = users.map((user) => ({ ...user, lastContractEvent: signed }));
  renderPage("rows");
  await screen.findByText("Ada");
  search("example.com");
  expect(shownNames()).toEqual(["Ada", "Sam"]);
});
