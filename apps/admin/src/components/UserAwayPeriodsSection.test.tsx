import type {
  CreateAwayRangeDto,
  UpdateAwayRangeDto,
  UserAwayRangeDto,
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
import UserAwayPeriodsSection from "./UserAwayPeriodsSection";

afterEach(cleanup);

const trip: UserAwayRangeDto = {
  id: 1,
  startDate: "2026-02-01T00:00:00.000Z",
  endDate: "2026-02-05T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  reason: "vacation",
  note: "Family trip",
};

let stored: UserAwayRangeDto[];
let loadStatus: number;
let createStatus: number;
let writes: { method: string; path: string; body: unknown }[];

const record = async (request: Request) => {
  const text = await request.text();
  writes.push({
    method: request.method,
    path: new URL(request.url).pathname,
    body: text ? JSON.parse(text) : null,
  });
  return text ? JSON.parse(text) : null;
};

serveApi(
  routes({
    "GET /user/awayranges/:id": () =>
      loadStatus === 200
        ? Response.json(stored)
        : Response.json({}, { status: loadStatus }),
    "POST /user/admin/:userId/awayranges": async ({ request }) => {
      const body: CreateAwayRangeDto = await record(request);
      if (createStatus !== 200)
        return Response.json(
          { message: "Away periods can't overlap." },
          { status: createStatus },
        );
      const created: UserAwayRangeDto = {
        ...trip,
        id: 2,
        startDate: `${body.startDay}T00:00:00.000Z`,
        endDate: `${body.endDay}T00:00:00.000Z`,
        reason: body.reason,
        note: body.note ?? null,
      };
      stored = [...stored, created];
      return Response.json(created);
    },
    "PATCH /user/admin/:userId/awayranges/:id": async ({ request }) => {
      const body: UpdateAwayRangeDto = await record(request);
      stored = stored.map((r) => ({
        ...r,
        reason: body.reason,
        note: body.note ?? null,
      }));
      return Response.json(stored[0]);
    },
    "DELETE /user/admin/:userId/awayranges/:id": async ({ request }) => {
      await record(request);
      stored = [];
      return new Response(null, { status: 200 });
    },
  }),
);

beforeEach(() => {
  stored = [trip];
  loadStatus = 200;
  createStatus = 200;
  writes = [];
});

const renderSection = () => {
  const query = queryWrapper();
  render(
    <ToastProvider>
      <UserAwayPeriodsSection user={{ id: 7, name: "Sam" }} />
    </ToastProvider>,
    query,
  );
  return query.client;
};

it("shows a spinner, then the loaded ranges with their count", async () => {
  renderSection();

  expect(screen.getByRole("status", { name: "Loading..." })).toBeTruthy();
  expect(await screen.findByText(/Family trip/)).toBeTruthy();
  expect(screen.getByRole("heading").textContent).toBe("Away Periods (1)");
});

it("says there are no away periods once an empty list loads", async () => {
  stored = [];

  renderSection();

  expect(await screen.findByText("No away periods.")).toBeTruthy();
  expect(screen.getByRole("heading").textContent).toBe("Away Periods (0)");
});

it("reports a failed load instead of an empty list", async () => {
  loadStatus = 500;

  renderSection();

  expect((await screen.findByText("Could not load away periods.")).role).toBe(
    "alert",
  );
  expect(screen.queryByText("No away periods.")).toBe(null);
  expect(screen.getByRole("heading").textContent).toBe("Away Periods");
});

it("keeps the loaded ranges when a refetch fails", async () => {
  const client = renderSection();
  await screen.findByText(/Family trip/);
  loadStatus = 500;

  void client.refetchQueries();

  expect((await screen.findByText("Could not load away periods.")).role).toBe(
    "alert",
  );
  expect(screen.getByText(/Family trip/)).toBeTruthy();
});

const fillCreateForm = async () => {
  await screen.findByText(/Family trip/);
  fireEvent.change(screen.getByLabelText("Start"), {
    target: { value: "2026-04-01" },
  });
  fireEvent.change(screen.getByLabelText("End"), {
    target: { value: "2026-04-03" },
  });
  fireEvent.change(screen.getByLabelText("Reason"), {
    target: { value: "vacation" },
  });
  fireEvent.change(screen.getByPlaceholderText("Note optional"), {
    target: { value: " Beach " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
};

it("schedules a range, lists it, and clears the form", async () => {
  renderSection();
  await fillCreateForm();

  expect(await screen.findByText(/Beach/)).toBeTruthy();
  expect(writes).toEqual([
    {
      method: "POST",
      path: "/user/admin/7/awayranges",
      body: {
        startDay: "2026-04-01",
        endDay: "2026-04-03",
        reason: "vacation",
        note: "Beach",
      },
    },
  ]);
  expect(screen.getByLabelText<HTMLInputElement>("Start").value).toBe("");
});

it("shows a refused schedule and keeps the form", async () => {
  createStatus = 400;
  renderSection();
  await fillCreateForm();

  expect(await screen.findByText("Away periods can't overlap.")).toBeTruthy();
  expect(screen.getByLabelText<HTMLInputElement>("Start").value).toBe(
    "2026-04-01",
  );
});

it("saves an edited note without resending unchanged days", async () => {
  renderSection();
  await screen.findByText(/Family trip/);

  fireEvent.click(screen.getByRole("button", { name: "Edit away period" }));
  fireEvent.change(screen.getByDisplayValue("Family trip"), {
    target: { value: "Ski trip" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  expect(await screen.findByText(/Ski trip/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Save" })).toBe(null);
  expect(writes).toEqual([
    {
      method: "PATCH",
      path: "/user/admin/7/awayranges/1",
      body: { reason: "vacation", note: "Ski trip" },
    },
  ]);
});

it("deletes a range once confirmed", async () => {
  renderSection();
  await screen.findByText(/Family trip/);

  fireEvent.click(screen.getByRole("button", { name: "Delete away period" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));

  expect(await screen.findByText("No away periods.")).toBeTruthy();
  await waitFor(() =>
    expect(writes).toEqual([
      { method: "DELETE", path: "/user/admin/7/awayranges/1", body: null },
    ]),
  );
});
