import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryClient } from "@alliance/sharedweb/lib/queryClient";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import {
  api,
  cacheSam,
  renderPage,
  serveUserDetailApi,
  volunteers,
} from "./UserDetailView.testHarness";

serveUserDetailApi();

it("loads the member alongside the rest of the page", async () => {
  api.detailStatus = 200;
  renderPage();

  expect(await screen.findByRole("heading", { name: "Sam" })).toBeTruthy();
});

it("shows the page shell while the member loads", async () => {
  api.detailStatus = 200;
  let release = () => {};
  api.detailGate = new Promise((resolve) => (release = resolve));
  renderPage();

  expect(
    (await screen.findByText("Loading member…")).getAttribute("role"),
  ).toBe("status");
  expect(screen.getByRole("heading", { name: "Member" })).toBeTruthy();

  release();
  expect(await screen.findByRole("heading", { name: "Sam" })).toBeTruthy();
});

it("groups the sections under views that link to each other", async () => {
  api.detailStatus = 200;
  renderPage("?view=connections");

  const views = within(
    await screen.findByRole("navigation", { name: "Member views" }),
  );
  expect(
    views
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")]),
  ).toEqual([
    ["Profile", "/member/7?view=profile"],
    ["Activity", "/member/7?view=activity"],
    ["Messages", "/member/7?view=messages"],
    ["Connections", "/member/7?view=connections"],
  ]);
  expect(
    views
      .getByRole("link", { name: "Connections" })
      .getAttribute("aria-current"),
  ).toBe("page");
  expect(screen.queryByRole("region", { name: "Roles" })).toBeNull();

  fireEvent.click(views.getByRole("link", { name: "Profile" }));
  expect(await screen.findByRole("region", { name: "Roles" })).toBeTruthy();
});

it("keeps a draft reply across view switches", async () => {
  api.detailStatus = 200;
  renderPage("?view=messages");

  const views = within(
    await screen.findByRole("navigation", { name: "Member views" }),
  );
  const draft = await screen.findByRole<HTMLTextAreaElement>("textbox", {
    name: /^Text /,
  });
  fireEvent.change(draft, { target: { value: "See you Tuesday" } });
  fireEvent.click(views.getByRole("link", { name: "Profile" }));
  await screen.findByRole("region", { name: "Roles" });
  fireEvent.click(views.getByRole("link", { name: "Messages" }));

  expect(
    (
      await screen.findByRole<HTMLTextAreaElement>("textbox", {
        name: /^Text /,
      })
    ).value,
  ).toBe("See you Tuesday");
});

it("puts destructive commands in the More menu behind a confirmation", async () => {
  api.detailStatus = 200;
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "More" }));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Delete account" }),
  );

  expect(await screen.findByRole("dialog")).toBeTruthy();
});

it("shows each channel default and each override with its source and whether it is in effect", async () => {
  api.detailStatus = 200;
  api.notificationSettings = {
    defaults: { inApp: false, push: false, text: true, email: true },
    overrides: [
      {
        kind: "likes",
        label: "Likes",
        channel: "push",
        enabled: true,
        source: "member",
        inEffect: true,
      },
      {
        kind: "member_left_community",
        label: "A member left a group you lead",
        channel: "push",
        enabled: false,
        source: "migrated",
        inEffect: false,
      },
    ],
  };
  renderPage();

  const section = within(
    await screen.findByRole("region", { name: "Notification settings" }),
  );
  await section.findByText("Overrides (2)");
  expect(
    ["In-app", "Push", "Text", "Email"].map(
      (label) => section.getByText(`${label} default`).nextSibling?.textContent,
    ),
  ).toEqual(["Off", "Off", "On", "On"]);
  expect(
    section.getAllByRole("listitem").map((row) => row.textContent),
  ).toEqual([
    "Likes · PushOnSet by member",
    "A member left a group you lead · PushOffCarried over by migrationNot in effect",
  ]);
});

it("says when every notification follows the defaults", async () => {
  api.detailStatus = 200;
  api.notificationSettings = {
    defaults: { inApp: true, push: true, text: true, email: true },
    overrides: [],
  };
  renderPage();

  const section = within(
    await screen.findByRole("region", { name: "Notification settings" }),
  );
  expect(await section.findByText("Overrides (0)")).toBeTruthy();
  expect(
    section.getByText("Every notification follows the defaults."),
  ).toBeTruthy();
});

it("keeps cached notification settings it could not refresh and says so", async () => {
  api.detailStatus = 200;
  queryClient.setQueryData(queryKeys.userNotificationSettingsAdmin(7), {
    defaults: { inApp: true, push: true, text: true, email: true },
    overrides: [],
  });
  renderPage();

  expect(
    await screen.findByText(
      "Could not refresh notification settings. Reload to see the latest.",
    ),
  ).toBeTruthy();
  expect(screen.getByText("Overrides (0)")).toBeTruthy();
});

it("says when the member's notification settings fail to load", async () => {
  api.detailStatus = 200;
  renderPage();

  expect(
    await screen.findByText("Failed to load notification settings."),
  ).toBeTruthy();
});

it("loads the member afresh over one cached moments ago", async () => {
  api.detailStatus = 200;
  cacheSam({ name: "Sam Before" });
  renderPage();

  expect(await screen.findByRole("heading", { name: "Sam" })).toBeTruthy();
});

it("says a member that does not exist was not found", async () => {
  renderPage();

  expect(await screen.findByText("Member not found")).toBeTruthy();
});

it("says the member failed to load", async () => {
  api.detailStatus = 500;
  renderPage();

  expect(
    (
      await screen.findByText("Failed to load member. Reload to try again.")
    ).getAttribute("role"),
  ).toBe("alert");
  expect(screen.getByRole("link", { name: "Members" })).toBeTruthy();
});

it("replaces a cached member who has since been deleted", async () => {
  cacheSam();
  renderPage();

  expect(await screen.findByText("Member not found")).toBeTruthy();
});

it("keeps a cached member it could not refresh and says so", async () => {
  api.detailStatus = 500;
  cacheSam();
  renderPage();

  expect(
    await screen.findByText(
      "Could not refresh this member. Reload to see the latest.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Sam" })).toBeTruthy();
});

it("names the member's contract status and roles beside their name", async () => {
  api.detailStatus = 200;
  api.stored = { ...api.stored, admin: true, staff: true };
  renderPage("?view=messages");

  const pills = within(
    await screen.findByRole("list", { name: "Status and roles" }),
  );
  expect(
    pills.getAllByRole("listitem").map((pill) => pill.textContent),
  ).toEqual(["Not signed", "Admin", "Staff"]);
  expect(await screen.findByRole("region", { name: "Texts" })).toBeTruthy();
});

it("says a member is away after their contract status", async () => {
  api.detailStatus = 200;
  api.stored = { ...api.stored, admin: true };
  const day = 24 * 60 * 60 * 1000;
  api.awayRanges = [
    {
      id: 1,
      startDate: new Date(Date.now() - day).toISOString(),
      endDate: new Date(Date.now() + day).toISOString(),
      createdAt: new Date(Date.now() - 2 * day).toISOString(),
      reason: "vacation",
      note: null,
    },
  ];
  renderPage();

  const pills = within(
    await screen.findByRole("list", { name: "Status and roles" }),
  );
  await pills.findByText("Away");
  expect(
    pills.getAllByRole("listitem").map((pill) => pill.textContent),
  ).toEqual(["Not signed", "Away", "Admin"]);
});

it("logs in as the member in a new tab", async () => {
  api.detailStatus = 200;
  renderPage();

  const link = await screen.findByRole("link", { name: "Log in as member" });
  expect(link.getAttribute("href")).toMatch(/\/auth\/impersonate\/7$/);
  expect(link.getAttribute("target")).toBe("_blank");
});

it("lists the member's contract events newest first", async () => {
  api.detailStatus = 200;
  api.stored = {
    ...api.stored,
    contractEvents: [
      {
        type: "signed",
        date: "2026-01-01T12:00:00Z",
        automatic: false,
        contractId: 1,
      },
      {
        type: "suspended",
        date: "2026-02-01T12:00:00Z",
        automatic: true,
        contractId: null,
      },
    ],
  };
  renderPage();

  const contract = within(
    await screen.findByRole("region", { name: "Contract" }),
  );
  expect(
    contract
      .getAllByText(/^(signed|suspended)$/)
      .map((type) => type.textContent),
  ).toEqual(["suspended", "signed"]);
});

it("says why a role change was refused", async () => {
  api.detailStatus = 200;
  renderPage();

  fireEvent.click(await screen.findByRole("checkbox", { name: "Staff" }));

  expect((await screen.findByText("Forbidden")).getAttribute("role")).toBe(
    "alert",
  );
  expect(
    screen.getByRole<HTMLInputElement>("checkbox", { name: "Staff" }).checked,
  ).toBe(false);
});

it("says why a suspension was refused instead of confirming it", async () => {
  api.detailStatus = 200;
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "More" }));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Suspend contract" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));

  expect(
    await screen.findByText("Member does not have an active contract."),
  ).toBeTruthy();
  expect(screen.queryByText("Contract suspended")).toBeNull();
});

it("disables Suspend contract with the reason when there is no active contract", async () => {
  api.detailStatus = 200;
  api.stored = { ...api.stored, hasActiveContract: false };
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "More" }));
  const item = await screen.findByRole("menuitem", {
    name: /^Suspend contract/,
  });
  expect(item.getAttribute("aria-disabled")).toBe("true");
  expect(item.textContent).toContain("This member has no active contract.");
});

const toggleVolunteers = async () => {
  fireEvent.click(await screen.findByRole("checkbox", { name: "Volunteers" }));
};

const volunteersBox = () =>
  screen.getByRole<HTMLInputElement>("checkbox", { name: "Volunteers" });

it("checks a tag once the member has it", async () => {
  api.detailStatus = 200;
  renderPage();

  await toggleVolunteers();

  await waitFor(() => expect(volunteersBox().checked).toBe(true));
  expect(screen.getByRole("heading", { name: "Tags 1" })).toBeTruthy();
});

it("says when a tag change is refused", async () => {
  api.detailStatus = 200;
  api.addTagStatus = 500;
  renderPage();

  await toggleVolunteers();

  expect(
    await screen.findByText("Failed to update tag membership. Try again."),
  ).toBeTruthy();
  expect(volunteersBox().checked).toBe(false);
});

it("says why a tag change was refused", async () => {
  api.detailStatus = 200;
  api.addTagStatus = 400;
  renderPage();

  await toggleVolunteers();

  expect(
    (await screen.findByText("Tag is archived")).getAttribute("role"),
  ).toBe("alert");
  expect(volunteersBox().checked).toBe(false);
});

it("says it could not refresh the member after a tag change", async () => {
  api.detailStatus = 200;
  renderPage();
  await screen.findByRole("checkbox", { name: "Volunteers" });
  api.detailStatus = 500;

  await toggleVolunteers();

  expect(
    await screen.findByText(
      "Could not refresh this member. Reload to see the latest.",
    ),
  ).toBeTruthy();
});

it("says when the tags fail to load", async () => {
  api.detailStatus = 200;
  api.tagSummariesStatus = 500;
  renderPage();

  expect(await screen.findByText("Failed to load tags")).toBeTruthy();
});

it("keeps cached tags it could not refresh and says so", async () => {
  api.detailStatus = 200;
  api.tagSummariesStatus = 500;
  queryClient.setQueryData(queryKeys.tagSummariesAdmin(), [volunteers]);
  renderPage();

  expect(
    await screen.findByText(
      "Could not refresh tags. Reload to see the latest.",
    ),
  ).toBeTruthy();
  expect(volunteersBox()).toBeTruthy();
});
