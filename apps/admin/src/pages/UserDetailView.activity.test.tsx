import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { userQueryKeys } from "@alliance/shared/lib/user";
import { queryClient } from "@alliance/sharedweb/lib/queryClient";
import { fireEvent, screen, within } from "@testing-library/react";
import {
  alex,
  api,
  relationsFor,
  renderPage,
  serveUserDetailApi,
} from "./UserDetailView.testHarness";

serveUserDetailApi();

describe("Connections", () => {
  it("lists the member's friends with their status", async () => {
    api.detailStatus = 200;
    renderPage("?view=connections");

    expect(
      await screen.findByRole("heading", { name: "Friends 1" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Alex/ }).getAttribute("href"),
    ).toBe("/member/8");
    expect(screen.getByText("Signed · Ambassador")).toBeTruthy();
  });

  it("says when the friends fail to load", async () => {
    api.detailStatus = 200;
    api.friendsStatus = 500;
    renderPage("?view=connections");

    expect(await screen.findByText("Failed to load friends")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Friends" })).toBeTruthy();
  });

  it("keeps cached friends it could not refresh and says so", async () => {
    api.detailStatus = 200;
    api.friendsStatus = 500;
    queryClient.setQueryData(userQueryKeys.friends(7), [alex]);
    renderPage("?view=connections");

    expect(
      await screen.findByText(
        "Could not refresh friends. Reload to see the latest.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Friends 1" })).toBeTruthy();
  });
});

it("lists the member's form submissions newest first", async () => {
  api.detailStatus = 200;
  api.formResponses = [
    makeFormResponse({ id: 1, formId: 4, createdAt: "2026-03-01T12:00:00Z" }),
    makeFormResponse({
      id: 2,
      formId: 9,
      createdAt: "2026-05-01T12:00:00Z",
      deviceType: "ios",
    }),
  ];
  renderPage("?view=activity");

  expect(
    await screen.findByRole("heading", { name: "Form submissions 2" }),
  ).toBeTruthy();
  expect(
    screen
      .getAllByRole("link", { name: /^Form #/ })
      .map((link) => [link.textContent, link.getAttribute("href")]),
  ).toEqual([
    ["Form #9", "/forms/9/responses"],
    ["Form #4", "/forms/4/responses"],
  ]);
  expect(screen.getByText("ios")).toBeTruthy();
});

it("says when the member has no form submissions", async () => {
  api.detailStatus = 200;
  renderPage("?view=activity");

  expect(await screen.findByText("No form submissions.")).toBeTruthy();
});

it("says when the member's notifications fail to load", async () => {
  api.detailStatus = 200;
  api.notifsStatus = 500;
  renderPage("?view=activity");

  expect(await screen.findByText("Failed to load notifications")).toBeTruthy();
});

it("keeps cached notifications it could not refresh and says so", async () => {
  api.detailStatus = 200;
  api.notifsStatus = 500;
  queryClient.setQueryData(queryKeys.userNotifsAdmin(7), []);
  renderPage("?view=activity");

  expect(
    await screen.findByText(
      "Could not refresh notifications. Reload to see the latest.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Notifications 0" })).toBeTruthy();
});

it("says when the member's form submissions fail to load", async () => {
  api.detailStatus = 200;
  api.formResponsesStatus = 500;
  renderPage("?view=activity");

  expect(
    await screen.findByText("Failed to load form submissions"),
  ).toBeTruthy();
  expect(screen.queryByText("No form submissions.")).toBeNull();
});

it("keeps cached form submissions it could not refresh and says so", async () => {
  api.detailStatus = 200;
  api.formResponsesStatus = 500;
  queryClient.setQueryData(queryKeys.userFormResponsesAdmin(7), []);
  renderPage("?view=activity");

  expect(
    await screen.findByText(
      "Could not refresh form submissions. Reload to see the latest.",
    ),
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Form submissions 0" }),
  ).toBeTruthy();
});

it("says when the member's actions fail to load", async () => {
  api.detailStatus = 200;
  api.relationsStatus = 500;
  renderPage("?view=activity");

  expect(await screen.findByText("Failed to load actions")).toBeTruthy();
});

it("records an activity for the member and shows their new status", async () => {
  api.detailStatus = 200;
  api.relations = relationsFor("todo");
  renderPage("?view=activity");

  const row = (await screen.findByText("Call your representative")).closest(
    "tr",
  );
  fireEvent.change(within(row!).getByRole("combobox"), {
    target: { value: "user_completed" },
  });

  expect(
    await screen.findByText("Completed", { selector: "span" }),
  ).toBeTruthy();
  expect(api.createdActivities).toEqual([
    { actionId: 5, userId: 7, type: "user_completed" },
  ]);
});

it("says it could not refresh the member's actions after recording one", async () => {
  api.detailStatus = 200;
  api.relations = relationsFor("todo");
  renderPage("?view=activity");
  const row = (await screen.findByText("Call your representative")).closest(
    "tr",
  );
  api.relationsStatus = 500;

  fireEvent.change(within(row!).getByRole("combobox"), {
    target: { value: "user_completed" },
  });

  expect(
    await screen.findByText(
      "Could not refresh actions. Reload to see the latest.",
    ),
  ).toBeTruthy();
  expect(screen.getByText("Not started", { selector: "span" })).toBeTruthy();
});
