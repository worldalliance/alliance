import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import {
  ada,
  api,
  lee,
  renderPage,
  sam,
  search,
  serveUsersListApi,
  shownNames,
  signed,
} from "./UsersList.testHarness";

serveUsersListApi();

it("orders members by total time spent", async () => {
  api.timeSpentTotal = () =>
    Response.json([
      { userId: sam.id, timeSpent: 30 },
      { userId: lee.id, timeSpent: 90 },
    ]);

  renderPage();

  await waitFor(() => expect(shownNames()).toEqual(["Lee", "Sam", "Ada"]));
});

it("says members aren't sorted when time spent fails to load", async () => {
  api.timeSpentTotal = () => Response.json({}, { status: 500 });

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

it("says when the members fail to load rather than showing none", async () => {
  api.usersStatus = 500;
  renderPage();

  expect(
    (await screen.findByText(/Couldn't load members/)).getAttribute("role"),
  ).toBe("alert");
  expect(screen.queryByText("No members yet.")).toBeNull();
});

it("keeps the loaded members when a refetch fails", async () => {
  const query = queryWrapper();
  renderPage("?view=grid", query);
  await screen.findByText("Ada");
  api.usersStatus = 500;
  await query.client
    .refetchQueries({ queryKey: queryKeys.usersAdmin() })
    .catch(() => {});
  await waitFor(() =>
    expect(query.client.getQueryState(queryKeys.usersAdmin())?.status).toBe(
      "error",
    ),
  );

  expect(screen.getByText("Ada")).toBeTruthy();
  expect(screen.queryByText(/Couldn't load members/)).toBeNull();
});

it("names each colour in the action history", async () => {
  renderPage("");
  const key = await screen.findByRole("list", { name: "Action history key" });
  expect(within(key).getByText("Completed")).toBeTruthy();
  expect(within(key).getByText("Missed deadline")).toBeTruthy();
  expect(within(key).getByText("Not yet completed")).toBeTruthy();
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
    expect(api.tagCalls).toEqual([
      { path: "t2/addUser", body: { userId: ada.id } },
    ]),
  );
});

it("removes a member from a tag from their card", async () => {
  await toggleTagOnCard({ member: "Lee", tagName: "Volunteers" });
  await waitFor(() =>
    expect(api.tagCalls).toEqual([
      { path: "t1/removeUser", body: { userId: lee.id } },
    ]),
  );
});

it("keeps loaded tags without an alert when a refetch fails", async () => {
  await toggleTagOnCard({ member: "Ada", tagName: "Donors" });
  api.tagsStatus = 500;
  await waitFor(() => expect(api.tagCalls).toHaveLength(1));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.queryByText(/^Couldn't load tags/)).toBeNull();
});

it("shows an error when a tag change fails", async () => {
  api.addUserStatus = 500;
  const errors = jest.spyOn(console, "error").mockImplementation(() => {});
  await toggleTagOnCard({ member: "Ada", tagName: "Donors" });
  expect(
    await screen.findByText("Failed to update tag membership. Try again."),
  ).toBeTruthy();
  errors.mockRestore();
});

it("pages the cards and returns to the first page on a new search", async () => {
  api.users = Array.from({ length: 51 }, (_, index) =>
    makeUser({
      id: index + 1,
      name: `Member ${index + 1}`,
      lastContractEvent: signed,
    }),
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
  renderPage("");
  await screen.findByText("Ada");
  search("example.com");
  expect(shownNames()).toEqual(["Ada", "Sam"]);
});

it("shuffles the shown members without changing who is shown", async () => {
  renderPage();
  await screen.findByText("Ada");
  fireEvent.click(screen.getByRole("button", { name: "Shuffle order" }));
  expect([...shownNames()].sort()).toEqual(["Ada", "Lee", "Sam"]);
});

it("says when there are no members at all", async () => {
  api.users = [];
  renderPage();
  expect(await screen.findByText("No members yet.")).toBeTruthy();
});
