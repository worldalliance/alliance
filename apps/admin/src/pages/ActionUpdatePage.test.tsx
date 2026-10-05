import type {
  AdminActionUpdateDto,
  UpdateActionUpdateDto,
} from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { HELD_POLL_MS } from "../lib/useRefreshWhileHeld";
import ActionUpdatePage from "./ActionUpdatePage";

afterEach(cleanup);

const update = (
  overrides: Partial<AdminActionUpdateDto> = {},
): AdminActionUpdateDto => ({
  id: 1,
  actionId: 2,
  title: "Hearing",
  schemaSnapshotId: 3,
  date: "2026-10-01T00:00:00.000Z",
  visibleAt: null,
  shortNotifString: "a hearing on the bill",
  associatedEventId: null,
  notifyType: "all_members",
  notifiedAt: null,
  schema: {
    blocks: [{ type: "display", kind: "header", id: "b1", text: "Body" }],
  },
  notificationMode: "normal",
  contributionFormula: null,
  retrospectiveContributionFormula: null,
  recognitionPreparedAt: null,
  notificationHeldReason: null,
  ...overrides,
});

let served: AdminActionUpdateDto = update();
let variantsAnswer: () => Response = () =>
  Response.json({ variants: [], stats: [] });

const api = serveApi(
  routes({
    "GET /actions/updates/admin/:id": () => Response.json(served),
    "GET /actions/adminslug/:id": () =>
      Response.json({
        id: 2,
        taskFormId: null,
        events: [
          {
            id: 5,
            title: "Launch",
            date: "2026-09-01T00:00:00.000Z",
          },
        ],
      }),
    "GET /actions/:id/form-variants": () => variantsAnswer(),
    "GET /user/tags": () => Response.json([]),
    "GET /tasks/listForms": () => Response.json([]),
  }),
);

const renderDetails = async () => {
  const router = createMemoryRouter(
    [
      {
        path: "/actions/:actionId/updates/:updateId",
        element: <ActionUpdatePage />,
      },
    ],
    { initialEntries: ["/actions/2/updates/1"] },
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Update Details" }),
  );
};

describe("ActionUpdatePage", () => {
  beforeEach(() => {
    served = update();
    variantsAnswer = () => Response.json({ variants: [], stats: [] });
  });

  it("shows no recognition copy for a legacy update", async () => {
    served = update({ notificationMode: "legacy" });

    await renderDetails();

    expect(screen.queryByText("Recognition copy")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Check recipients" }),
    ).toBeNull();
  });

  it("offers the check and the formula until each member's copy is frozen", async () => {
    await renderDetails();

    expect(
      await screen.findByRole("button", { name: "Check recipients" }),
    ).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Mode" })).toBeTruthy();
  });

  it("stops offering the check and the formula once copy is frozen", async () => {
    served = update({
      notifiedAt: "2026-10-01T00:00:00.000Z",
      recognitionPreparedAt: "2026-10-01T00:00:00.000Z",
    });

    await renderDetails();

    expect(await screen.findByText(/copy was frozen/)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Check recipients" }),
    ).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Mode" })).toBeNull();
  });

  it("keeps the action's events when its form variants fail to load", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    variantsAnswer = () =>
      Response.json({ statusCode: 500, message: "boom" }, { status: 500 });

    await renderDetails();

    expect(
      await screen.findByText(/The action's forms couldn't be loaded/),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: /^Launch/ })).toBeTruthy();
  });

  it("holds the check until a typed formula is saved into the active mode's column", async () => {
    let saved: UpdateActionUpdateDto | undefined;
    api.alsoServing({
      "PATCH /actions/updateUpdate/:id": async ({ request }) => {
        saved = await request.json();
        return Response.json({ ...served, ...saved });
      },
    });
    await renderDetails();

    const [formula] = screen
      .getAllByRole("textbox")
      .filter((box) => box instanceof HTMLTextAreaElement);
    fireEvent.change(formula, { target: { value: '"3 letters"' } });
    expect(screen.getByText("Save your changes before checking.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(
      await screen.findByText(
        "Resolves each recipient's contribution, as sending would.",
      ),
    ).toBeTruthy();
    expect(saved).toMatchObject({
      notificationMode: "normal",
      contributionFormula: { inputs: {}, formula: '"3 letters"' },
      retrospectiveContributionFormula: null,
    });
  });
});

describe("while an update's notifications are on hold", () => {
  const realSetInterval = globalThis.setInterval;

  beforeEach(() => {
    served = update({ notificationHeldReason: "Nobody resolves." });
    // Shortens the held poll the way WaitlistEmailsPage.test.tsx does; the
    // cast only bridges the DOM and bun overloads of setInterval.
    globalThis.setInterval = ((handler: TimerHandler, delay?: number) =>
      realSetInterval(
        handler,
        delay === HELD_POLL_MS ? 10 : delay,
      )) as typeof setInterval;
  });

  afterEach(() => {
    globalThis.setInterval = realSetInterval;
  });

  it("drops the banner once the server sends the update", async () => {
    await renderDetails();
    expect(await screen.findByText("Nobody resolves.")).toBeTruthy();

    served = update({ recognitionPreparedAt: "2026-10-01T00:00:00.000Z" });

    await waitFor(() =>
      expect(screen.queryByText("Nobody resolves.")).toBeNull(),
    );
  });

  it("keeps a save over a poll response that left before it", async () => {
    await renderDetails();
    await screen.findByText("Nobody resolves.");
    let releasePoll = () => {};
    let pollWaiting = false;
    api.alsoServing({
      "GET /actions/updates/admin/:id": async () => {
        if (pollWaiting) return new Promise<Response>(() => {});
        const before = served;
        pollWaiting = true;
        await new Promise<void>((release) => (releasePoll = release));
        return Response.json(before);
      },
      "PATCH /actions/updateUpdate/:id": async ({ request }) => {
        served = { ...served, ...(await request.json()) };
        return Response.json(served);
      },
    });
    await waitFor(() => expect(pollWaiting).toBe(true));

    const [formula] = screen
      .getAllByRole("textbox")
      .filter((box) => box instanceof HTMLTextAreaElement);
    fireEvent.change(formula, { target: { value: '"3 letters"' } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await screen.findByText(
      "Resolves each recipient's contribution, as sending would.",
    );
    releasePoll();
    await Bun.sleep(30);

    expect(screen.queryByText("Save your changes before checking.")).toBeNull();
  });

  it("keeps a save whose response lands in the same tick as the poll's", async () => {
    await renderDetails();
    await screen.findByText("Nobody resolves.");
    let releasePoll = () => {};
    let releaseSave = () => {};
    let pollWaiting = false;
    let saveWaiting = false;
    api.alsoServing({
      "GET /actions/updates/admin/:id": async () => {
        if (pollWaiting) return new Promise<Response>(() => {});
        const before = served;
        pollWaiting = true;
        await new Promise<void>((release) => (releasePoll = release));
        return Response.json(before);
      },
      "PATCH /actions/updateUpdate/:id": async ({ request }) => {
        served = { ...served, ...(await request.json()) };
        saveWaiting = true;
        await new Promise<void>((release) => (releaseSave = release));
        return Response.json(served);
      },
    });
    await waitFor(() => expect(pollWaiting).toBe(true));

    const [formula] = screen
      .getAllByRole("textbox")
      .filter((box) => box instanceof HTMLTextAreaElement);
    fireEvent.change(formula, { target: { value: '"3 letters"' } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(saveWaiting).toBe(true));
    releaseSave();
    releasePoll();

    expect(
      await screen.findByText(
        "Resolves each recipient's contribution, as sending would.",
      ),
    ).toBeTruthy();
    await Bun.sleep(30);
    expect(screen.queryByText("Save your changes before checking.")).toBeNull();
  });
});
