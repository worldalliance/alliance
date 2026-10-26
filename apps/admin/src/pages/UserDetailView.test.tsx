import type {
  CreateActionActivityDto,
  NotificationSettingsAdminDto,
  UserActionRelationsResponseDto,
  UserAdminDetailDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  makeProfile,
  makeTag,
  makeUser,
} from "@alliance/shared/lib/testFixtures";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { userQueryKeys } from "@alliance/shared/lib/user";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { omit } from "es-toolkit";
import { createMemoryRouter, RouterProvider } from "react-router";
import { AuthProvider } from "../lib/AuthContext";
import { queryClient } from "../lib/queryClient";
import UserDetailView, { clientLoader } from "./UserDetailView";

const sam: UserAdminDetailDto = {
  ...makeUser({ id: 7, name: "Sam", hasActiveContract: true }),
  communities: [],
  tags: [],
  location: {},
  invitedBy: null,
};

const alex = { ...makeProfile(8), displayName: "Alex", ambassador: true };

const tagDto = makeTag();
const volunteers = omit(tagDto, ["users"]);

let stored: UserAdminDetailDto;
let notificationSettings: NotificationSettingsAdminDto | null;
let detailStatus: number;
let addTagStatus: number;
let relations: UserActionRelationsResponseDto;
let relationsStatus: number;
let tagSummariesStatus: number;
let friendsStatus: number;
let createdActivities: CreateActionActivityDto[];
let memberRequested: () => void;
let memberRequest: Promise<void>;

serveApi(
  routes(
    {
      "GET /user/userdetail/:id": () => {
        memberRequested();
        return detailStatus === 200
          ? Response.json(stored)
          : Response.json(
              { message: "User not found" },
              { status: detailStatus },
            );
      },
      "GET /user/userdetail/:id/notification-settings": () =>
        notificationSettings
          ? Response.json(notificationSettings)
          : Response.json({}, { status: 500 }),
      "PATCH /user/userdetail/:id/roles": () =>
        Response.json({ message: "Forbidden" }, { status: 400 }),
      "POST /contract/admin/suspend/:userId": () =>
        Response.json(
          { message: "Member does not have an active contract." },
          { status: 400 },
        ),
      "GET /user/tag-summaries": () =>
        tagSummariesStatus === 200
          ? Response.json([volunteers])
          : Response.json({}, { status: tagSummariesStatus }),
      "POST /user/tags/:tagId/addUser": () => {
        if (addTagStatus !== 200) {
          return Response.json({}, { status: addTagStatus });
        }
        stored = { ...stored, tags: [volunteers] };
        return Response.json(tagDto);
      },
      "GET /actions/action-relations/:userId": () =>
        relationsStatus === 200
          ? Response.json(relations)
          : Response.json({}, { status: relationsStatus }),
      "POST /actions/createActivity": async ({ request }) => {
        const body: CreateActionActivityDto = await request.json();
        createdActivities.push(body);
        relations = relationsFor("completed");
        return Response.json({});
      },
      // Answers only once the member is requested, so a member fetch that
      // waits for the loader never starts.
      "GET /notifs/for-user/:id": async () => {
        await memberRequest;
        return Response.json([]);
      },
      "POST /tasks/formsForUserSID/:userId": () => Response.json([]),
      "GET /user/listfriends/:id": () =>
        friendsStatus === 200
          ? Response.json([alex])
          : Response.json({}, { status: friendsStatus }),
    },
    // The sections a loaded member renders load their own data.
    () => Response.json({}, { status: 404 }),
  ),
);

beforeAll(() => queryClient.setDefaultOptions({ queries: { retry: false } }));

beforeEach(() => {
  stored = sam;
  notificationSettings = null;
  detailStatus = 404;
  addTagStatus = 200;
  relations = { actions: [], suites: [], users: [] };
  relationsStatus = 200;
  tagSummariesStatus = 200;
  friendsStatus = 200;
  createdActivities = [];
  memberRequest = new Promise((resolve) => {
    memberRequested = resolve;
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});

const renderPage = () => {
  const router = createMemoryRouter(
    [
      {
        path: "/members/:userId",
        Component: UserDetailView,
        loader: (args) =>
          clientLoader({
            ...args,
            params: { userId: args.params.userId ?? "" },
          }),
      },
    ],
    { initialEntries: ["/members/7"] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
};

const relationsFor = (
  status: "todo" | "completed",
): UserActionRelationsResponseDto => ({
  actions: [
    {
      id: 5,
      name: "Call your representative",
      status: "member_action",
      weekNumber: 1,
      allMembersParticipating: false,
      memberActionDeadline: null,
    },
  ],
  suites: [],
  users: [{ userId: 7, relations: [{ actionId: 5, status }] }],
});

const cacheSam = (overrides: Partial<UserAdminDetailDto> = {}) =>
  queryClient.setQueryData(queryKeys.userDetailAdmin(7), {
    ...sam,
    ...overrides,
  });

it("loads the member alongside the rest of the page", async () => {
  detailStatus = 200;
  renderPage();

  expect(await screen.findByRole("heading", { name: "Sam" })).toBeTruthy();
});

it("shows each channel default and each override with its source and whether it is in effect", async () => {
  detailStatus = 200;
  notificationSettings = {
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
  detailStatus = 200;
  notificationSettings = {
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
  detailStatus = 200;
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
  detailStatus = 200;
  renderPage();

  expect(
    await screen.findByText("Failed to load notification settings."),
  ).toBeTruthy();
});

it("loads the member afresh over one cached moments ago", async () => {
  detailStatus = 200;
  cacheSam({ name: "Sam Before" });
  renderPage();

  expect(await screen.findByRole("heading", { name: "Sam" })).toBeTruthy();
});

it("says a member that does not exist was not found", async () => {
  renderPage();

  expect(await screen.findByText("Member not found")).toBeTruthy();
});

it("says the member failed to load", async () => {
  detailStatus = 500;
  renderPage();

  expect(await screen.findByText("Failed to load member")).toBeTruthy();
});

it("replaces a cached member who has since been deleted", async () => {
  cacheSam();
  renderPage();

  expect(await screen.findByText("Member not found")).toBeTruthy();
});

it("keeps a cached member it could not refresh and says so", async () => {
  detailStatus = 500;
  cacheSam();
  renderPage();

  expect(
    await screen.findByText(
      "Could not refresh this member. Reload to see their latest details.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Sam" })).toBeTruthy();
});

it("says when a role change is refused", async () => {
  detailStatus = 200;
  renderPage();

  fireEvent.click(await screen.findByRole("checkbox", { name: "Staff" }));

  expect(
    await screen.findByText("Failed to update role. Try again."),
  ).toBeTruthy();
  expect(
    screen.getByRole<HTMLInputElement>("checkbox", { name: "Staff" }).checked,
  ).toBe(false);
});

it("says when a suspension is refused instead of confirming it", async () => {
  detailStatus = 200;
  renderPage();

  fireEvent.click(
    await screen.findByRole("button", { name: "Suspend contract" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));

  expect(
    await screen.findByText("Failed to suspend contract. Try again."),
  ).toBeTruthy();
  expect(screen.queryByText("Contract suspended")).toBeNull();
});

const toggleVolunteers = async () => {
  fireEvent.click(await screen.findByRole("checkbox", { name: "Volunteers" }));
};

const volunteersBox = () =>
  screen.getByRole<HTMLInputElement>("checkbox", { name: "Volunteers" });

it("checks a tag once the member has it", async () => {
  detailStatus = 200;
  renderPage();

  await toggleVolunteers();

  await waitFor(() => expect(volunteersBox().checked).toBe(true));
  expect(screen.getByText("Tags (1)")).toBeTruthy();
});

it("says when a tag change is refused", async () => {
  detailStatus = 200;
  addTagStatus = 500;
  renderPage();

  await toggleVolunteers();

  expect(
    await screen.findByText("Failed to update tag membership. Try again."),
  ).toBeTruthy();
  expect(volunteersBox().checked).toBe(false);
});

it("says it could not refresh the member after a tag change", async () => {
  detailStatus = 200;
  renderPage();
  await screen.findByRole("checkbox", { name: "Volunteers" });
  detailStatus = 500;

  await toggleVolunteers();

  expect(
    await screen.findByText(
      "Could not refresh this member. Reload to see their latest details.",
    ),
  ).toBeTruthy();
});

it("says when the tags fail to load", async () => {
  detailStatus = 200;
  tagSummariesStatus = 500;
  renderPage();

  expect(await screen.findByText("Failed to load tags")).toBeTruthy();
});

it("keeps cached tags it could not refresh and says so", async () => {
  detailStatus = 200;
  tagSummariesStatus = 500;
  queryClient.setQueryData(queryKeys.tagSummariesAdmin(), [volunteers]);
  renderPage();

  expect(
    await screen.findByText(
      "Could not refresh tags. Reload to see the latest.",
    ),
  ).toBeTruthy();
  expect(volunteersBox()).toBeTruthy();
});

it("lists the member's friends with their status", async () => {
  detailStatus = 200;
  renderPage();

  expect(await screen.findByText("Friends (1)")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Alex/ }).getAttribute("href")).toBe(
    "/member/8",
  );
  expect(screen.getByText("Signed · Ambassador")).toBeTruthy();
});

it("says when the friends fail to load", async () => {
  detailStatus = 200;
  friendsStatus = 500;
  renderPage();

  expect(await screen.findByText("Failed to load friends")).toBeTruthy();
});

it("keeps cached friends it could not refresh and says so", async () => {
  detailStatus = 200;
  friendsStatus = 500;
  queryClient.setQueryData(userQueryKeys.friends(7), [alex]);
  renderPage();

  expect(
    await screen.findByText(
      "Could not refresh friends. Reload to see the latest.",
    ),
  ).toBeTruthy();
  expect(screen.getByText("Friends (1)")).toBeTruthy();
});

it("says when the member's actions fail to load", async () => {
  detailStatus = 200;
  relationsStatus = 500;
  renderPage();

  expect(await screen.findByText("Failed to load actions")).toBeTruthy();
});

it("records an activity for the member and shows their new status", async () => {
  detailStatus = 200;
  relations = relationsFor("todo");
  renderPage();

  const row = (await screen.findByText("Call your representative")).closest(
    "tr",
  );
  fireEvent.change(within(row!).getByRole("combobox"), {
    target: { value: "user_completed" },
  });

  expect(
    await screen.findByText("Completed", { selector: "span" }),
  ).toBeTruthy();
  expect(createdActivities).toEqual([
    { actionId: 5, userId: 7, type: "user_completed" },
  ]);
});

it("says it could not refresh the member's actions after recording one", async () => {
  detailStatus = 200;
  relations = relationsFor("todo");
  renderPage();
  const row = (await screen.findByText("Call your representative")).closest(
    "tr",
  );
  relationsStatus = 500;

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
