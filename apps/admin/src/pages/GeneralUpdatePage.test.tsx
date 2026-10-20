import type {
  ActionSuiteDto,
  CreateGeneralUpdateDto,
  UpdateGeneralUpdateDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { makeProfile, makeTag } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { generalUpdateAdmin } from "../lib/testing/generalUpdateAdmin";
import GeneralUpdatePage from "./GeneralUpdatePage";

afterEach(cleanup);

const startDate = "2026-03-10T15:00:00.000Z";
const endDate = "2026-03-20T22:30:00.000Z";
let saved: UpdateGeneralUpdateDto | null = null;
let created: CreateGeneralUpdateDto | null = null;
let servedName = "Weekly note";
let findStatus = 200;
let updateStatus = 200;
let suitesStatus = 200;
const deferred = () => Promise.withResolvers<void>();
type Deferred = ReturnType<typeof deferred>;
let pickersRequested: Record<"tags" | "suites" | "members", Deferred> | null =
  null;
const suite = {
  id: 7,
  name: "Spring",
  actions: [],
  events: [],
  reminderGroups: [],
  generalUpdates: [],
} satisfies ActionSuiteDto;
const tag = makeTag({ id: "t1", name: "Volunteers" });

serveApi(
  routes({
    "GET /actions/generalUpdates/admin/:id": async () => {
      if (pickersRequested)
        await Promise.all(
          Object.values(pickersRequested).map(({ promise }) => promise),
        );
      return findStatus === 200
        ? Response.json(
            generalUpdateAdmin(1, servedName, { startDate, endDate }),
          )
        : Response.json({}, { status: findStatus });
    },
    "POST /actions/generalUpdates/create": async ({ request }) => {
      created = await request.json();
      return Response.json(generalUpdateAdmin(2, "New"));
    },
    "PATCH /actions/generalUpdates/:id": async ({ request }) => {
      if (updateStatus !== 200)
        return Response.json({}, { status: updateStatus });
      saved = await request.json();
      return Response.json(
        generalUpdateAdmin(1, saved?.name ?? "Weekly note", {
          startDate,
          endDate,
        }),
      );
    },
    "GET /actions/suites": () => {
      pickersRequested?.suites.resolve();
      return Response.json(suitesStatus === 200 ? [suite] : {}, {
        status: suitesStatus,
      });
    },
    "GET /user/members": () => {
      pickersRequested?.members.resolve();
      return Response.json([{ ...makeProfile(5), displayName: "Ana" }]);
    },
    "GET /user/tags": () => {
      pickersRequested?.tags.resolve();
      return Response.json([tag]);
    },
  }),
);

const hostZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
beforeEach(() => {
  saved = null;
  created = null;
  servedName = "Weekly note";
  findStatus = 200;
  updateStatus = 200;
  suitesStatus = 200;
  pickersRequested = null;
  process.env.TZ = "America/New_York";
});
afterEach(() => {
  process.env.TZ = hostZone;
});

const renderPage = (
  path = "/general-updates/1",
  cached?: ReturnType<typeof generalUpdateAdmin>,
) => {
  const router = createMemoryRouter(
    [{ path: "/general-updates/:id", element: <GeneralUpdatePage /> }],
    { initialEntries: [path] },
  );
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.generalUpdatesAdmin(), []);
  if (cached)
    query.client.setQueryData(queryKeys.generalUpdateAdmin(cached.id), cached);
  render(<RouterProvider router={router} />, query);
  return { client: query.client, router };
};

const listInvalidated = (client: ReturnType<typeof renderPage>["client"]) =>
  client.getQueryState(queryKeys.generalUpdatesAdmin())?.isInvalidated;

it("shows the stored schedule in the admin's local time", async () => {
  renderPage();
  const start = await screen.findByLabelText<HTMLInputElement>("Start Date");
  await waitFor(() => expect(start.value).toBe("2026-03-10T11:00"));
  expect(screen.getByLabelText<HTMLInputElement>("End Date").value).toBe(
    "2026-03-20T18:30",
  );
});

it("saves an untouched schedule unchanged", async () => {
  renderPage();
  const start = await screen.findByLabelText<HTMLInputElement>("Start Date");
  await waitFor(() => expect(start.value).not.toBe(""));

  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

  await waitFor(() => expect(saved).not.toBeNull());
  expect(saved).toMatchObject({ startDate, endDate });
});

it("refreshes the general updates list after creating one", async () => {
  const { client, router } = renderPage("/general-updates/new");
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "New" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Create General Update" }),
  );

  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/general-updates/2"),
  );
  expect(listInvalidated(client)).toBe(true);
});

it("creates a general update with the entered details", async () => {
  renderPage("/general-updates/new");
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "New" },
  });
  fireEvent.change(screen.getByLabelText("Start Date"), {
    target: { value: "2026-03-10T11:00" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Create General Update" }),
  );

  await waitFor(() => expect(created).not.toBeNull());
  expect(created).toMatchObject({
    name: "New",
    startDate,
    useManualCohort: false,
    manualCohortUserIds: [],
  });
});

it("refreshes the general updates list after saving", async () => {
  const { client } = renderPage();
  await screen.findByLabelText("Title");

  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

  await waitFor(() => expect(listInvalidated(client)).toBe(true));
});

it("keeps unsaved edits when the general update reloads", async () => {
  const { client } = renderPage();
  const title = await screen.findByLabelText("Title");
  fireEvent.change(title, { target: { value: "Edited" } });
  servedName = "Changed elsewhere";

  await client.refetchQueries({ queryKey: queryKeys.generalUpdateAdmin(1) });
  await screen.findByRole("heading", { name: "Changed elsewhere" });

  expect(title).toHaveProperty("value", "Edited");
});

it("saves the reloaded details over a copy cached by an earlier visit", async () => {
  renderPage("/general-updates/1", generalUpdateAdmin(1, "Old cached name"));
  await screen.findByRole("heading", { name: "Weekly note" });
  await waitFor(() =>
    expect(screen.getByLabelText("Title")).toHaveProperty(
      "value",
      "Weekly note",
    ),
  );

  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

  await waitFor(() => expect(saved).not.toBeNull());
  expect(saved?.name).toBe("Weekly note");
});

it("reports a failed reload over a copy cached by an earlier visit", async () => {
  findStatus = 500;
  renderPage("/general-updates/1", generalUpdateAdmin(1, "Old cached name"));

  expect(
    await screen.findByText("Failed to load general update"),
  ).toBeDefined();
  expect(screen.queryByLabelText("Title")).toBeNull();
});

it("titles the page with the saved name", async () => {
  renderPage();
  const title = await screen.findByLabelText("Title");
  fireEvent.change(title, { target: { value: "Monthly note" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

  expect(
    await screen.findByRole("heading", { name: "Monthly note" }),
  ).toBeDefined();
});

it("reports a general update that does not exist", async () => {
  findStatus = 404;
  renderPage();

  expect(await screen.findByText("General update not found")).toBeDefined();
});

it("reports a failed load", async () => {
  findStatus = 500;
  renderPage();

  expect(
    await screen.findByText("Failed to load general update"),
  ).toBeDefined();
});

it("assigns the suite named in the link to a new general update", async () => {
  renderPage("/general-updates/new?suiteId=3");

  expect(
    await screen.findByRole("button", { name: "Remove Suite #3" }),
  ).toBeDefined();
  expect(screen.queryByLabelText("Start Date")).toBeNull();
});

it("saves the picked suite, tags, and manual cohort", async () => {
  renderPage();
  await screen.findByLabelText("Title");

  fireEvent.click(await screen.findByLabelText(/Volunteers/));
  fireEvent.click(screen.getByLabelText("Enable"));
  fireEvent.change(await screen.findByPlaceholderText("Search by name"), {
    target: { value: "Ana" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "Ana" }));
  fireEvent.change(await screen.findByLabelText("Add suite"), {
    target: { value: "7" },
  });
  expect(screen.queryByLabelText("Start Date")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

  await waitFor(() => expect(saved).not.toBeNull());
  expect(saved).toMatchObject({
    suiteIds: [7],
    tagIds: ["t1"],
    useManualCohort: true,
    manualCohortUserIds: [5],
  });
  expect(saved).not.toHaveProperty("startDate");
  expect(saved).not.toHaveProperty("endDate");
});

it("saves without a tag that was unticked", async () => {
  renderPage();
  await screen.findByLabelText("Title");
  const volunteers = await screen.findByLabelText(/Volunteers/);

  fireEvent.click(volunteers);
  fireEvent.click(volunteers);
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

  await waitFor(() => expect(saved).not.toBeNull());
  expect(saved?.tagIds).toEqual([]);
});

it("removes a suite and brings back the schedule", async () => {
  renderPage("/general-updates/new?suiteId=7");
  fireEvent.click(await screen.findByRole("button", { name: "Remove Spring" }));

  expect(await screen.findByLabelText("Start Date")).toBeDefined();
});

it("loads the pickers alongside the general update", async () => {
  pickersRequested = {
    tags: deferred(),
    suites: deferred(),
    members: deferred(),
  };
  renderPage();

  expect(await screen.findByLabelText(/Volunteers/)).toBeDefined();
});

it("reports suites that failed to load", async () => {
  suitesStatus = 500;
  renderPage();

  expect(await screen.findByText("Failed to load suites.")).toBeDefined();
  expect(screen.queryByText("No suites available.")).toBeNull();
});

it("reports a failed save and keeps the form", async () => {
  updateStatus = 500;
  const errors = jest.spyOn(console, "error").mockImplementation(() => {});
  renderPage();
  const title = await screen.findByLabelText("Title");
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

  expect(
    await screen.findByText("Failed to save general update"),
  ).toBeDefined();
  expect(screen.getByLabelText("Title")).toBe(title);
  errors.mockRestore();
});
