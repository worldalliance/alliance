/* alliance/max-lines 550 -- the member page's tests share one mocked API and fixture set */
import type {
  CreateActionActivityDto,
  FormResponseDto,
  NotificationSettingsAdminDto,
  UserActionRelationsResponseDto,
  UserAdminDetailDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  makeFormResponse,
  makeProfile,
  makeTag,
  makeUser,
} from "@alliance/shared/lib/testFixtures";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { userQueryKeys } from "@alliance/shared/lib/user";
import { queryClient } from "@alliance/sharedweb/lib/queryClient";
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
import { AuthProvider } from "../../lib/AuthContext";
import { ToastProvider } from "../../ui/ToastProvider";
import MemberPage, { clientLoader } from "./MemberPage";

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
let formResponses: FormResponseDto[];
let notifsStatus: number;
let formResponsesStatus: number;
let createdActivities: CreateActionActivityDto[];

serveApi(
  routes(
    {
      "GET /user/userdetail/:id": () =>
        detailStatus === 200
          ? Response.json(stored)
          : Response.json(
              { message: "User not found" },
              { status: detailStatus },
            ),
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
          return Response.json(
            { message: "Tag is archived" },
            { status: addTagStatus },
          );
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
      "GET /notifs/for-user/:id": () =>
        notifsStatus === 200
          ? Response.json([])
          : Response.json({}, { status: notifsStatus }),
      "POST /tasks/formsForUserSID/:userId": () =>
        formResponsesStatus === 200
          ? Response.json(formResponses)
          : Response.json({}, { status: formResponsesStatus }),
      "GET /user/awayranges/:id": () => Response.json([]),
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
  formResponses = [];
  notifsStatus = 200;
  formResponsesStatus = 200;
  createdActivities = [];
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});

const renderPage = (tab?: string, path = "/members/7") => {
  const router = createMemoryRouter(
    [
      {
        path: "/members/:userId",
        Component: MemberPage,
        loader: (args) =>
          clientLoader({
            ...args,
            params: { userId: args.params.userId ?? "" },
          }),
      },
    ],
    { initialEntries: [tab ? `${path}?tab=${tab}` : path] },
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

  expect(
    await screen.findByRole("heading", { name: "Sam", level: 1 }),
  ).toBeTruthy();
});

it("says an id that can't exist was not found without asking for it", async () => {
  detailStatus = 200;
  renderPage(undefined, "/members/abc");

  expect(await screen.findByText("Member not found")).toBeTruthy();
});

const settingsPanel = async () =>
  within(await screen.findByRole("region", { name: "Notification settings" }));

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
  renderPage("notifications");

  const section = await settingsPanel();
  await section.findByText("2 overrides");
  expect(
    ["In-app", "Push", "Text", "Email"].map(
      (label) => section.getByText(`${label} default`).nextSibling?.textContent,
    ),
  ).toEqual(["Off", "Off", "On", "On"]);
  expect(
    section
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.textContent),
  ).toEqual([
    "LikesPushOnSet by member",
    "A member left a group you leadPushOffNot in effectCarried over by migration",
  ]);
});

it("says when every notification follows the defaults", async () => {
  detailStatus = 200;
  notificationSettings = {
    defaults: { inApp: true, push: true, text: true, email: true },
    overrides: [],
  };
  renderPage("notifications");

  const section = await settingsPanel();
  expect(await section.findByText("0 overrides")).toBeTruthy();
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
  renderPage("notifications");

  expect(
    await screen.findByText(/Couldn't refresh notification settings\./),
  ).toBeTruthy();
  expect(screen.getByText("0 overrides")).toBeTruthy();
});

it("says when the member's notification settings fail to load", async () => {
  detailStatus = 200;
  renderPage("notifications");

  expect(
    await screen.findByText("Couldn't load notification settings"),
  ).toBeTruthy();
});

it("loads the member afresh over one cached moments ago", async () => {
  detailStatus = 200;
  cacheSam({ name: "Sam Before" });
  renderPage();

  expect(
    await screen.findByRole("heading", { name: "Sam", level: 1 }),
  ).toBeTruthy();
});

it("says a member that does not exist was not found", async () => {
  renderPage();

  expect(await screen.findByText("Member not found")).toBeTruthy();
});

it("says the member failed to load", async () => {
  detailStatus = 500;
  renderPage();

  expect(await screen.findByText("Couldn't load this member")).toBeTruthy();
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
    await screen.findByText(/Couldn't refresh this member\./),
  ).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Sam", level: 1 })).toBeTruthy();
});

it("says why a role change was refused", async () => {
  detailStatus = 200;
  renderPage("membership");

  fireEvent.click(await screen.findByRole("switch", { name: "Staff" }));

  expect(await screen.findByText("Forbidden")).toBeTruthy();
  expect(
    screen.getByRole("switch", { name: "Staff" }).getAttribute("aria-checked"),
  ).toBe("false");
});

it("says why a suspension was refused instead of confirming it", async () => {
  detailStatus = 200;
  renderPage();

  fireEvent.click(await screen.findByRole("button", { name: "More" }));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Suspend contract…" }),
  );
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Suspend contract",
    }),
  );

  expect(
    await screen.findByText("Member does not have an active contract."),
  ).toBeTruthy();
  expect(screen.queryByText("Contract suspended")).toBeNull();
});

const toggleVolunteers = async () => {
  fireEvent.click(await screen.findByRole("switch", { name: "Volunteers" }));
};

const volunteersOn = () =>
  screen
    .getByRole("switch", { name: "Volunteers" })
    .getAttribute("aria-checked");

const tagsPanel = () => within(screen.getByRole("region", { name: "Tags" }));

it("switches a tag on once the member has it", async () => {
  detailStatus = 200;
  renderPage("membership");

  await toggleVolunteers();

  await waitFor(() => expect(volunteersOn()).toBe("true"));
  expect(tagsPanel().getByText("1")).toBeTruthy();
});

it("says when a tag change is refused", async () => {
  detailStatus = 200;
  addTagStatus = 500;
  renderPage("membership");

  await toggleVolunteers();

  expect(
    await screen.findByText("Couldn't change the member's tags."),
  ).toBeTruthy();
  expect(volunteersOn()).toBe("false");
});

it("says why a tag change was refused", async () => {
  detailStatus = 200;
  addTagStatus = 400;
  renderPage("membership");

  await toggleVolunteers();

  expect(await screen.findByText("Tag is archived")).toBeTruthy();
  expect(volunteersOn()).toBe("false");
});

it("says it could not refresh the member after a tag change", async () => {
  detailStatus = 200;
  renderPage("membership");
  await screen.findByRole("switch", { name: "Volunteers" });
  detailStatus = 500;

  await toggleVolunteers();

  expect(
    await screen.findByText(/Couldn't refresh this member\./),
  ).toBeTruthy();
});

it("says when the tags fail to load", async () => {
  detailStatus = 200;
  tagSummariesStatus = 500;
  renderPage("membership");

  expect(await screen.findByText("Couldn't load tags")).toBeTruthy();
});

it("keeps cached tags it could not refresh and says so", async () => {
  detailStatus = 200;
  tagSummariesStatus = 500;
  queryClient.setQueryData(queryKeys.tagSummariesAdmin(), [volunteers]);
  renderPage("membership");

  expect(await screen.findByText(/Couldn't refresh tags\./)).toBeTruthy();
  expect(screen.getByRole("switch", { name: "Volunteers" })).toBeTruthy();
});

const friendsPanel = () =>
  within(screen.getByRole("region", { name: "Friends" }));

it("lists the member's friends with their standing", async () => {
  detailStatus = 200;
  renderPage("profile");

  expect(await screen.findByRole("link", { name: "Alex" })).toBeTruthy();
  expect(friendsPanel().getByText("1")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Alex" }).getAttribute("href")).toBe(
    "/members/8",
  );
  expect(screen.getByText("Signed · Ambassador")).toBeTruthy();
});

it("says when the friends fail to load", async () => {
  detailStatus = 200;
  friendsStatus = 500;
  renderPage("profile");

  expect(await screen.findByText("Couldn't load friends")).toBeTruthy();
});

it("keeps cached friends it could not refresh and says so", async () => {
  detailStatus = 200;
  friendsStatus = 500;
  queryClient.setQueryData(userQueryKeys.friends(7), [alex]);
  renderPage("profile");

  expect(await screen.findByText(/Couldn't refresh friends\./)).toBeTruthy();
  expect(friendsPanel().getByText("1")).toBeTruthy();
});

const responsesPanel = () =>
  within(screen.getByRole("region", { name: "Form responses" }));

it("lists the member's form responses newest first", async () => {
  detailStatus = 200;
  formResponses = [
    makeFormResponse({ id: 1, formId: 4, createdAt: "2026-03-01T12:00:00Z" }),
    makeFormResponse({
      id: 2,
      formId: 9,
      createdAt: "2026-05-01T12:00:00Z",
      deviceType: "ios",
    }),
  ];
  renderPage("tasks");

  expect(await screen.findByRole("link", { name: "Form #9" })).toBeTruthy();
  expect(responsesPanel().getByText("2")).toBeTruthy();
  expect(
    screen
      .getAllByRole("link", { name: /^Form #/ })
      .map((link) => [link.textContent, link.getAttribute("href")]),
  ).toEqual([
    ["Form #9", "/tasks/forms/9?tab=responses"],
    ["Form #4", "/tasks/forms/4?tab=responses"],
  ]);
  expect(screen.getByText("ios")).toBeTruthy();
});

it("says when the member has no form responses", async () => {
  detailStatus = 200;
  renderPage("tasks");

  expect(await screen.findByText("No form responses")).toBeTruthy();
});

it("says when the member's notifications fail to load", async () => {
  detailStatus = 200;
  notifsStatus = 500;
  renderPage("notifications");

  expect(await screen.findByText("Couldn't load notifications")).toBeTruthy();
});

it("keeps cached notifications it could not refresh and says so", async () => {
  detailStatus = 200;
  notifsStatus = 500;
  queryClient.setQueryData(queryKeys.userNotifsAdmin(7), []);
  renderPage("notifications");

  expect(
    await screen.findByText(/Couldn't refresh notifications\./),
  ).toBeTruthy();
  expect(screen.getByText("No texts sent")).toBeTruthy();
});

it("says when the member's form responses fail to load", async () => {
  detailStatus = 200;
  formResponsesStatus = 500;
  renderPage("tasks");

  expect(await screen.findByText("Couldn't load form responses")).toBeTruthy();
  expect(screen.queryByText("No form responses")).toBeNull();
});

it("keeps cached form responses it could not refresh and says so", async () => {
  detailStatus = 200;
  formResponsesStatus = 500;
  queryClient.setQueryData(queryKeys.userFormResponsesAdmin(7), []);
  renderPage("tasks");

  expect(
    await screen.findByText(/Couldn't refresh form responses\./),
  ).toBeTruthy();
  expect(screen.getByText("No form responses")).toBeTruthy();
});

it("says when the member's tasks fail to load", async () => {
  detailStatus = 200;
  relationsStatus = 500;
  renderPage("tasks");

  expect(await screen.findByText("Couldn't load tasks")).toBeTruthy();
});

const recordCompleted = async () => {
  fireEvent.click(
    await screen.findByRole("button", {
      name: "More: Call your representative",
    }),
  );
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Record “Completed”…" }),
  );
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Record activity",
    }),
  );
};

it("records an activity for the member once confirmed and shows their new status", async () => {
  detailStatus = 200;
  relations = relationsFor("todo");
  renderPage("tasks");

  await recordCompleted();

  expect(
    await screen.findByText("Completed", { selector: "span" }),
  ).toBeTruthy();
  expect(createdActivities).toEqual([
    { actionId: 5, userId: 7, type: "user_completed" },
  ]);
});

it("says it could not refresh the member's tasks after recording one", async () => {
  detailStatus = 200;
  relations = relationsFor("todo");
  renderPage("tasks");
  await screen.findByText("Call your representative");
  relationsStatus = 500;

  await recordCompleted();

  expect(await screen.findByText(/Couldn't refresh tasks\./)).toBeTruthy();
  expect(screen.getByText("Not started", { selector: "span" })).toBeTruthy();
});

it("shows a task the member has no record for without failing", async () => {
  detailStatus = 200;
  relations = { ...relationsFor("todo"), users: [] };
  renderPage("tasks");

  const row = (await screen.findByText("Call your representative")).closest(
    "tr",
  );
  expect(within(row!).getAllByText("—").length).toBeGreaterThan(0);
});
