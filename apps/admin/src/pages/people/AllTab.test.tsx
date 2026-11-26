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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "../../ui/ToastProvider";
import PeoplePage from "./PeoplePage";

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
let timeSpentTotal: () => Response | Promise<Response>;
let relationsStatus = 200;
let tagsStatus = 200;
let tagsLoaded: Promise<unknown>;
const tagCalls: { path: string; body: unknown }[] = [];

serveApi(
  routes({
    "GET /user/list": () => Response.json(users),
    "GET /analytics/time-spent-per-user-total": () => timeSpentTotal(),
    "GET /user/tags": async () => {
      await tagsLoaded;
      return Response.json(tags, { status: tagsStatus });
    },
    "GET /actions/action-relations": () =>
      Response.json(
        { actions: [], suites: [], users: [] },
        { status: relationsStatus },
      ),
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

// The list opens on signed members.
const signed: ContractEventDto = {
  type: "signed",
  date: "2026-01-01T00:00:00.000Z",
  automatic: false,
  contractId: null,
};
const signedUp = (user: UserDto) => ({ ...user, lastContractEvent: signed });

beforeEach(() => {
  users = [ada, sam, lee].map(signedUp);
  tags = [
    makeTag({ id: "t1", name: "Volunteers", users: [makeProfile(lee.id)] }),
    makeTag({ id: "t2", name: "Donors", users: [makeProfile(sam.id)] }),
  ];
  addUserStatus = 200;
  timeSpentTotal = () => Response.json([]);
  relationsStatus = 200;
  tagsStatus = 200;
  tagsLoaded = Promise.resolve();
  tagCalls.length = 0;
});

const renderPage = (url = "/members") =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[url]}>
        <PeoplePage />
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
    screen.getByRole("searchbox", { name: "Search by name, email or phone" }),
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

it("holds the rows until what orders them has loaded", async () => {
  let release = () => {};
  timeSpentTotal = () =>
    new Promise((resolve) => {
      release = () =>
        resolve(
          Response.json([
            { userId: sam.id, timeSpent: 30 },
            { userId: lee.id, timeSpent: 90 },
          ]),
        );
    });

  renderPage();

  expect(await screen.findByText("3 members")).toBeTruthy();
  expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
  expect(shownNames()).toEqual([]);
  release();
  await waitFor(() => expect(shownNames()).toEqual(["Lee", "Sam", "Ada"]));
});

it("says members aren't sorted when time spent fails to load", async () => {
  timeSpentTotal = () => Response.json({}, { status: 500 });

  renderPage();

  expect(
    (await screen.findByText(/^Couldn't load time spent\./)).closest(
      '[role="alert"]',
    ),
  ).toBeTruthy();
  expect(shownNames()).toEqual(["Ada", "Sam", "Lee"]);
});

it("filters by role and names the selection on the button", async () => {
  renderPage();
  await screen.findByText("Ada");
  openFilter("Roles: All roles");
  expect(
    screen.getByRole("checkbox", { name: /Admin.*1 member$/ }),
  ).toBeTruthy();
  expect(
    screen.getByRole("checkbox", { name: /Staff.*2 members$/ }),
  ).toBeTruthy();

  fireEvent.click(screen.getByRole("checkbox", { name: /Admin/ }));
  expect(shownNames()).toEqual(["Ada"]);
  expect(screen.getByRole("button", { name: "Roles: Admin" })).toBeTruthy();

  fireEvent.click(screen.getByRole("checkbox", { name: /Staff/ }));
  expect(shownNames()).toEqual(["Ada", "Sam", "Lee"]);
  expect(screen.getByRole("button", { name: "Roles: 2 roles" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(shownNames()).toEqual(["Ada", "Sam", "Lee"]);
  expect(screen.getByRole("button", { name: "Roles: All roles" })).toBeTruthy();
});

it("filters by tag and names the selection on the button", async () => {
  renderPage();
  await screen.findByText("Ada");
  openFilter("Tags: All tags");

  fireEvent.click(screen.getByRole("checkbox", { name: /Volunteers/ }));
  expect(shownNames()).toEqual(["Lee"]);
  expect(screen.getByRole("button", { name: "Tags: Volunteers" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Clear filters" })).toBeTruthy();

  fireEvent.click(screen.getByRole("checkbox", { name: /Donors/ }));
  expect(shownNames()).toEqual(["Sam", "Lee"]);
  expect(screen.getByRole("button", { name: "Tags: 2 tags" })).toBeTruthy();
});

it("says so when there are no tags to filter by", async () => {
  tags = [];
  renderPage();
  await screen.findByText("Ada");
  openFilter("Tags: All tags");
  expect(screen.getByText("No tags yet")).toBeTruthy();
});

it("doesn't apply the caught-up filter while task records failed to load", async () => {
  relationsStatus = 500;
  renderPage("/members?status=caught_up");
  await screen.findByText(/^Couldn't load the members' task records\./);
  expect(shownNames()).toEqual(["Ada", "Sam", "Lee"]);
});

it("holds the rows while tags load under a tag filter", async () => {
  let release = () => {};
  tagsLoaded = new Promise<void>((resolve) => {
    release = resolve;
  });

  renderPage("/members?tag=t1");

  expect(await screen.findByText("3 members")).toBeTruthy();
  expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
  expect(shownNames()).toEqual([]);
  release();
  await waitFor(() => expect(shownNames()).toEqual(["Lee"]));
});

it("doesn't apply the tags filter while tags failed to load", async () => {
  tagsStatus = 500;
  renderPage("/members?tag=t1");
  await screen.findByText(/^Couldn't load tags\./);
  expect(shownNames()).toEqual(["Ada", "Sam", "Lee"]);
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
  expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();

  openFilter("Roles: All roles");
  fireEvent.click(screen.getByRole("checkbox", { name: /Staff/ }));
  expect(screen.getByRole("button", { name: "Clear filters" })).toBeTruthy();
  search("lee");
  openFilter("Tags: All tags");
  fireEvent.click(screen.getByRole("checkbox", { name: /Volunteers/ }));
  expect(shownNames()).toEqual(["Lee"]);

  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(shownNames()).toEqual(["Ada", "Sam", "Lee"]);
  expect(screen.getByRole("button", { name: "Roles: All roles" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Tags: All tags" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
});

const toggleTagInRow = async ({
  member,
  tagName,
}: {
  member: string;
  tagName: string;
}) => {
  renderPage();
  fireEvent.click(
    await screen.findByRole("button", { name: `Details: ${member}` }),
  );
  fireEvent.click(screen.getByRole("button", { name: `Edit tags: ${member}` }));
  fireEvent.click(
    await screen.findByRole("menuitemcheckbox", { name: new RegExp(tagName) }),
  );
};

it("adds a member to a tag from their row", async () => {
  await toggleTagInRow({ member: "Ada", tagName: "Donors" });
  await waitFor(() =>
    expect(tagCalls).toEqual([
      { path: "t2/addUser", body: { userId: ada.id } },
    ]),
  );
});

it("removes a member from a tag from their row", async () => {
  await toggleTagInRow({ member: "Lee", tagName: "Volunteers" });
  await waitFor(() =>
    expect(tagCalls).toEqual([
      { path: "t1/removeUser", body: { userId: lee.id } },
    ]),
  );
});

it("shows an error when a tag change fails", async () => {
  addUserStatus = 500;
  await toggleTagInRow({ member: "Ada", tagName: "Donors" });
  expect(
    (await screen.findByText(/^Couldn't update the tags of Ada\./)).closest(
      '[role="alert"]',
    ),
  ).toBeTruthy();
});

it("pages the members and returns to the first page on a new search", async () => {
  users = Array.from({ length: 51 }, (_, index) =>
    signedUp(makeUser({ id: index + 1, name: `Member ${index + 1}` })),
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

it("shows only signed members until the contract filter changes", async () => {
  users = [signedUp(ada), sam, lee];
  renderPage();
  await screen.findByText("Ada");
  expect(shownNames()).toEqual(["Ada"]);
  expect(screen.getByRole("option", { name: "Signed (1)" })).toBeTruthy();

  fireEvent.change(screen.getByRole("combobox", { name: "Contract" }), {
    target: { value: "not_signed" },
  });
  expect(shownNames()).toEqual(["Sam", "Lee"]);
});

it("says no member has signed, with a way to all members, when none has", async () => {
  users = [sam, lee];
  renderPage();
  expect(await screen.findByText("No signed members")).toBeTruthy();
  expect(screen.queryByText("No members yet")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Show all members" }));
  expect(shownNames()).toEqual(["Sam", "Lee"]);
});

it("says there are no members yet when there are none", async () => {
  users = [];
  renderPage();
  expect(await screen.findByText("No members yet")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Show all members" })).toBeNull();
});
