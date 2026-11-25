import type {
  CreateAwayRangeDto,
  UpdateAwayRangeDto,
  UserAwayRangeDto,
} from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { useUserAwayRangesAdmin } from "../../lib/useUserAwayRangesAdmin";
import { ToastProvider } from "../../ui/ToastProvider";
import { MemberAwayPanel } from "./MemberAwayPanel";

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
      const id = Number(new URL(request.url).pathname.split("/").pop());
      stored = stored.filter((range) => range.id !== id);
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

function Harness() {
  const away = useUserAwayRangesAdmin(7);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      {error && <p>{error}</p>}
      <MemberAwayPanel
        member={{ id: 7, name: "Sam" }}
        away={away}
        reportError={setError}
        clearError={() => setError(null)}
      />
    </>
  );
}

const renderSection = () => {
  const query = queryWrapper();
  render(
    <MemoryRouter>
      <ToastProvider>
        <Harness />
      </ToastProvider>
    </MemoryRouter>,
    query,
  );
  return query.client;
};

const panel = () =>
  within(screen.getByRole("region", { name: "Away periods" }));

it("shows the loading state, then the loaded ranges with their count", async () => {
  renderSection();

  expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
  expect(await screen.findByText("Family trip")).toBeTruthy();
  expect(panel().getByText("1")).toBeTruthy();
});

it("says there are no away periods once an empty list loads", async () => {
  stored = [];

  renderSection();

  expect(await screen.findByText("No away periods")).toBeTruthy();
  expect(panel().getByText("0")).toBeTruthy();
});

it("reports a failed load instead of an empty list", async () => {
  loadStatus = 500;

  renderSection();

  expect(await screen.findByText("Couldn't load away periods")).toBeTruthy();
  expect(screen.queryByText("No away periods")).toBe(null);
  expect(panel().queryByText("0")).toBe(null);
});

it("keeps the loaded ranges when a refetch fails", async () => {
  const client = renderSection();
  await screen.findByText("Family trip");
  loadStatus = 500;

  void client.refetchQueries();

  expect(
    await screen.findByText(/Couldn't refresh away periods\./),
  ).toBeTruthy();
  expect(screen.getByText("Family trip")).toBeTruthy();
});

const dialog = () => within(screen.getByRole("dialog"));

const fillCreateForm = async () => {
  await screen.findByText("Family trip");
  fireEvent.click(screen.getByRole("button", { name: "Schedule time away…" }));
  fireEvent.change(dialog().getByLabelText("Start"), {
    target: { value: "2030-04-01" },
  });
  fireEvent.change(dialog().getByLabelText("End"), {
    target: { value: "2030-04-03" },
  });
  fireEvent.change(dialog().getByLabelText("Reason"), {
    target: { value: "vacation" },
  });
  fireEvent.change(dialog().getByLabelText(/Note/), {
    target: { value: " Beach " },
  });
  fireEvent.click(dialog().getByRole("button", { name: "Schedule time away" }));
};

it("schedules a range, lists it, and closes the form", async () => {
  renderSection();
  await fillCreateForm();

  expect(await screen.findByText("Beach")).toBeTruthy();
  expect(writes).toEqual([
    {
      method: "POST",
      path: "/user/admin/7/awayranges",
      body: {
        startDay: "2030-04-01",
        endDay: "2030-04-03",
        reason: "vacation",
        note: "Beach",
      },
    },
  ]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBe(null));
});

it("shows a refused schedule and keeps the form", async () => {
  createStatus = 400;
  renderSection();
  await fillCreateForm();

  expect(await screen.findByText("Away periods can't overlap.")).toBeTruthy();
  expect(dialog().getByLabelText<HTMLInputElement>("Start").value).toBe(
    "2030-04-01",
  );
});

it("saves an edited note without resending unchanged days", async () => {
  renderSection();
  await screen.findByText("Family trip");

  fireEvent.click(screen.getByRole("button", { name: /^Edit:/ }));
  fireEvent.change(dialog().getByDisplayValue("Family trip"), {
    target: { value: "Ski trip" },
  });
  fireEvent.click(dialog().getByRole("button", { name: "Save away period" }));

  expect(await screen.findByText("Ski trip")).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBe(null));
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
  await screen.findByText("Family trip");

  fireEvent.click(screen.getByRole("button", { name: /^Delete:/ }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete away period" }),
  );

  expect(await screen.findByText("No away periods")).toBeTruthy();
  await waitFor(() =>
    expect(writes).toEqual([
      { method: "DELETE", path: "/user/admin/7/awayranges/1", body: null },
    ]),
  );
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Schedule time away…" }),
    ),
  );
});

it("moves focus to the other period's Edit after a delete", async () => {
  stored = [trip, { ...trip, id: 2, note: "Conference" }];
  renderSection();
  await screen.findByText("Conference");
  fireEvent.click(screen.getAllByRole("button", { name: /^Delete:/ })[0]);
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete away period" }),
  );
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: /^Edit:/ })).toHaveLength(1),
  );
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /^Edit:/ }),
    ),
  );
});

const openWith = async (name: string | RegExp) => {
  const opener = await screen.findByRole("button", { name });
  opener.focus();
  fireEvent.click(opener);
  await waitFor(() =>
    expect(document.activeElement).toBe(dialog().getByLabelText("Start")),
  );
  return opener;
};

it("focuses Start on open and returns to the opener on Cancel", async () => {
  renderSection();
  await screen.findByText("Family trip");
  const opener = await openWith("Schedule time away…");

  fireEvent.click(dialog().getByRole("button", { name: "Cancel" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBe(null));
  await waitFor(() => expect(document.activeElement).toBe(opener));
});

it("returns focus to the row's Edit button after Save", async () => {
  renderSection();
  await screen.findByText("Family trip");
  const opener = await openWith(/^Edit:/);

  fireEvent.click(dialog().getByRole("button", { name: "Save away period" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBe(null));
  await waitFor(() => expect(document.activeElement).toBe(opener));
});

it("moves focus to a refusal and keeps it in the dialog", async () => {
  createStatus = 400;
  renderSection();
  await screen.findByText("Family trip");
  await openWith("Schedule time away…");
  fireEvent.change(dialog().getByLabelText("Start"), {
    target: { value: "2030-04-01" },
  });
  fireEvent.change(dialog().getByLabelText("End"), {
    target: { value: "2030-04-03" },
  });
  fireEvent.change(dialog().getByLabelText("Reason"), {
    target: { value: "vacation" },
  });
  fireEvent.click(dialog().getByRole("button", { name: "Schedule time away" }));

  const refusal = await dialog().findByText("Away periods can't overlap.");
  await waitFor(() =>
    expect(refusal.closest("[tabindex='-1']")).toBe(document.activeElement),
  );
  expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(
    true,
  );
});

it("focuses Schedule time away when the edited period left the list", async () => {
  const client = renderSection();
  await screen.findByText("Family trip");
  await openWith(/^Edit:/);
  stored = [];
  await client.refetchQueries();
  await screen.findByText("No away periods");

  fireEvent.click(dialog().getByRole("button", { name: "Cancel" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBe(null));
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Schedule time away…" }),
    ),
  );
});
