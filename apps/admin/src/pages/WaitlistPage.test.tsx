import type {
  AdminWaitlistEntryDto,
  WaitlistEntrySearchDto,
} from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import WaitlistPage from "./WaitlistPage";

afterEach(cleanup);

const entry = (
  id: number,
  fields: Partial<AdminWaitlistEntryDto> = {},
): AdminWaitlistEntryDto => ({
  id,
  name: `Person ${id}`,
  email: `person${id}@example.com`,
  reason: null,
  organization: null,
  sourceLink: null,
  referrer: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  mobilizedAt: null,
  unsubscribedAt: null,
  inviteState: "none",
  tags: [],
  ...fields,
});

const campaign = {
  code: "code",
  picture: null,
  communityId: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

let searches: WaitlistEntrySearchDto[] = [];
let searchStatus = 200;
let searchTotal = 2;

serveApi(
  routes({
    "POST /waitlist/admin/entries/search": async ({ request }) => {
      const body: WaitlistEntrySearchDto = await request.json();
      searches.push(body);
      if (searchStatus !== 200) {
        return Response.json({}, { status: searchStatus });
      }
      return Response.json({
        entries: [
          entry(1, { reason: "I care" }),
          entry(2, { referrer: { id: 1, name: "Person 1" } }),
        ],
        total: searchTotal,
      });
    },
    "GET /campaigns": () =>
      Response.json([
        { ...campaign, id: 7, name: "Acme", kind: "organization" },
        { ...campaign, id: 8, name: "Spring drive", kind: "campaign" },
      ]),
    "GET /waitlist/admin/links": () =>
      Response.json([
        {
          id: 9,
          code: "news-code",
          organizationId: 7,
          channel: "Newsletter",
          publishedAt: null,
          archivedAt: null,
          createdAt: "2026-09-01T00:00:00.000Z",
          entryCount: 1,
        },
      ]),
  }),
);

beforeEach(() => {
  searches = [];
  searchStatus = 200;
  searchTotal = 2;
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <WaitlistPage />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

it("lists entries newest first with their total", async () => {
  renderPage();
  expect(await screen.findByText("person1@example.com")).toBeTruthy();
  expect(screen.getByText("I care")).toBeTruthy();
  expect(screen.getByText("2 entries")).toBeTruthy();
  expect(searches[0]).toEqual({
    filter: {},
    sort: "joined_desc",
    offset: 0,
    limit: 50,
  });
});

it("filters by a referrer and by status", async () => {
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Person 1" }));
  await waitFor(() =>
    expect(searches.at(-1)?.filter).toEqual({ referrerIds: [1] }),
  );

  fireEvent.change(screen.getByLabelText("Mobilized"), {
    target: { value: "false" },
  });
  await waitFor(() =>
    expect(searches.at(-1)?.filter).toEqual({
      referrerIds: [1],
      mobilized: false,
    }),
  );

  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await waitFor(() => expect(searches.at(-1)?.filter).toEqual({}));
});

it("clears a referrer filter from its chip", async () => {
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Person 1" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Clear referrer filter" }),
  );
  await waitFor(() => expect(searches.at(-1)?.filter).toEqual({}));
});

it("pages through entries and returns to the first page on a new filter", async () => {
  searchTotal = 120;
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.click(screen.getByRole("button", { name: "2" }));
  await waitFor(() => expect(searches.at(-1)?.offset).toBe(50));

  fireEvent.change(screen.getByLabelText("Mobilized"), {
    target: { value: "false" },
  });
  await waitFor(() =>
    expect(searches.at(-1)).toMatchObject({
      filter: { mobilized: false },
      offset: 0,
    }),
  );
});

it("clears a search still being typed", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.change(screen.getByLabelText("Mobilized"), {
    target: { value: "false" },
  });
  const box = screen.getByLabelText("Search name or email");
  fireEvent.change(box, { target: { value: "pat" } });
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(searches.at(-1)?.filter).toEqual({});
  expect(box).toHaveProperty("value", "");
});

it("searches after typing stops", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.change(screen.getByLabelText("Search name or email"), {
    target: { value: "  pat " },
  });
  await waitFor(() =>
    expect(searches.at(-1)?.filter).toEqual({ search: "pat" }),
  );
});

it("sorts by organization from the first page", async () => {
  searchTotal = 120;
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.click(screen.getByRole("button", { name: "2" }));
  await waitFor(() => expect(searches.at(-1)?.offset).toBe(50));
  fireEvent.click(screen.getByRole("button", { name: "Organization" }));
  await waitFor(() => expect(searches.at(-1)?.offset).toBe(0));
  await waitFor(() => expect(searches.at(-1)?.sort).toBe("organization_asc"));
  fireEvent.click(screen.getByRole("button", { name: "Organization" }));
  await waitFor(() => expect(searches.at(-1)?.sort).toBe("organization_desc"));
});

it("says the waitlist failed to load", async () => {
  searchStatus = 500;
  renderPage();
  expect(await screen.findByText("Unable to load the waitlist.")).toBeTruthy();
  expect(screen.queryByText("Loading…")).toBeNull();
});

it("toggles an invite state filter", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.click(screen.getByRole("button", { name: /^Invite/ }));
  const unused = await screen.findByRole("menuitemcheckbox", {
    name: "Unused",
  });
  fireEvent.click(unused);
  await waitFor(() =>
    expect(searches.at(-1)?.filter).toEqual({ inviteStates: ["unused"] }),
  );
  fireEvent.click(unused);
  await waitFor(() => expect(searches.at(-1)?.filter).toEqual({}));
});

it("filters by an inclusive join date range", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.change(screen.getByLabelText("Joined on or after"), {
    target: { value: "2026-09-01" },
  });
  fireEvent.change(screen.getByLabelText("Joined on or before"), {
    target: { value: "2026-09-10" },
  });
  await waitFor(() =>
    expect(searches.at(-1)?.filter).toEqual({
      joinedFrom: new Date("2026-09-01T00:00").toISOString(),
      joinedBefore: new Date("2026-09-11T00:00").toISOString(),
    }),
  );
});

it("filters by organization and by link", async () => {
  renderPage();
  await screen.findByText("person1@example.com");
  fireEvent.click(screen.getByRole("button", { name: /^Organization\s*·/ }));
  expect(
    screen.queryByRole("menuitemcheckbox", { name: "Spring drive" }),
  ).toBeNull();
  fireEvent.click(
    await screen.findByRole("menuitemcheckbox", { name: "Acme" }),
  );
  await waitFor(() =>
    expect(searches.at(-1)?.filter).toEqual({ organizationIds: [7] }),
  );

  fireEvent.click(screen.getByRole("button", { name: /^Link\s*·/ }));
  fireEvent.click(
    await screen.findByRole("menuitemcheckbox", { name: "Acme · Newsletter" }),
  );
  await waitFor(() =>
    expect(searches.at(-1)?.filter).toEqual({
      organizationIds: [7],
      sourceLinkIds: [9],
    }),
  );
});
