import type {
  AdminActionUpdateDto,
  UpdateActionUpdateDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { actionUpdateAdmin as update } from "../lib/testing/actionUpdateAdmin";
import { HELD_POLL_MS } from "../lib/useActionUpdateAdmin";
import ActionUpdatePage from "./ActionUpdatePage";

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

let served: AdminActionUpdateDto = update();
let variantsAnswer: () => Response = () =>
  Response.json({ variants: [], stats: [] });
let countedAudiences: unknown[] = [];

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
    "POST /actions/updates/:id/recognition-preview-counts": async ({
      request,
    }) => {
      countedAudiences.push(await request.json());
      return Response.json({
        completedPersonal: 1,
        completedCollective: 2,
        completedUndrawn: 0,
        didNotComplete: 3,
        uninvolved: 4,
      });
    },
  }),
);

const renderPage = (
  params: { path?: string; cached?: AdminActionUpdateDto } = {},
) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (params.cached) {
    client.setQueryData(queryKeys.actionUpdateAdmin(1), params.cached);
  }
  const router = createMemoryRouter(
    [
      {
        path: "/actions/:actionId/updates/:updateId",
        element: <ActionUpdatePage />,
      },
    ],
    { initialEntries: [params.path ?? "/actions/2/updates/1"] },
  );
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

const renderDetails = async () => {
  renderPage();
  fireEvent.click(
    await screen.findByRole("button", { name: "Update Details" }),
  );
};

describe("ActionUpdatePage", () => {
  beforeEach(() => {
    served = update();
    variantsAnswer = () => Response.json({ variants: [], stats: [] });
    countedAudiences = [];
  });

  it("says an update id that isn't a number is invalid", async () => {
    renderPage({ path: "/actions/2/updates/abc" });

    expect(await screen.findByText("Invalid update id")).toBeTruthy();
  });

  it("says a missing update wasn't found", async () => {
    api.alsoServing({
      "GET /actions/updates/admin/:id": () =>
        Response.json({ statusCode: 404 }, { status: 404 }),
    });

    renderPage();

    expect(await screen.findByText("Update not found")).toBeTruthy();
  });

  it("says the update failed to load on any other error", async () => {
    api.alsoServing({
      "GET /actions/updates/admin/:id": () =>
        Response.json({ statusCode: 500 }, { status: 500 }),
    });

    renderPage();

    expect(await screen.findByText("Failed to load update")).toBeTruthy();
  });

  it("waits for a reload rather than filling from a copy cached by an earlier visit", async () => {
    let release = () => {};
    let reloading = false;
    api.alsoServing({
      "GET /actions/updates/admin/:id": async () => {
        reloading = true;
        await new Promise<void>((resolve) => (release = resolve));
        return Response.json(update({ title: "Fresh" }));
      },
    });

    renderPage({ cached: update({ title: "Stale" }) });
    await waitFor(() => expect(reloading).toBe(true));

    expect(screen.getByText("Loading update...")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Update Details" })).toBeNull();

    release();
    fireEvent.click(
      await screen.findByRole("button", { name: "Update Details" }),
    );
    expect(screen.getAllByRole("textbox")[0]).toHaveProperty("value", "Fresh");
  });

  it("says the update failed to load when a reload over a cached copy fails", async () => {
    api.alsoServing({
      "GET /actions/updates/admin/:id": () =>
        Response.json({ statusCode: 500 }, { status: 500 }),
    });

    renderPage({ cached: update() });

    expect(await screen.findByText("Failed to load update")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Update Details" })).toBeNull();
  });

  it("says why the server refused a notification", async () => {
    jest.spyOn(window, "confirm").mockReturnValue(true);
    jest.spyOn(console, "error").mockImplementation(() => {});
    api.alsoServing({
      "POST /actions/updates/:id/notify": () =>
        Response.json(
          { statusCode: 409, message: "Already notified" },
          { status: 409 },
        ),
    });
    await renderDetails();

    fireEvent.click(screen.getByRole("button", { name: "Send notification" }));

    expect(await screen.findByText("Already notified")).toBeTruthy();
  });

  it("shows no recognition copy for a legacy update", async () => {
    served = update({ notificationMode: "legacy" });

    await renderDetails();

    expect(screen.queryByText("Recognition copy")).toBeNull();
    expect(screen.queryByText("Preview Update")).toBeNull();
    expect(screen.queryByText("Split by who completed the action")).toBeNull();
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
    expect(screen.queryByText("Preview Update")).toBeNull();
    expect(countedAudiences).toEqual([]);
  });

  it("previews every variation as the collective result is typed and split", async () => {
    await renderDetails();
    const preview = () =>
      screen.getByText("Preview Update").closest("div.border") as HTMLElement;

    fireEvent.change(screen.getByDisplayValue("a hearing on the bill"), {
      target: { value: "a vote" },
    });
    expect(preview().textContent).toContain("PushUpdate: a vote");
    expect(await within(preview()).findByText("9 members")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Split by who completed the action",
      }),
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: /^Away or not involved/ }),
      { target: { value: "a vote while you were away" } },
    );

    expect(preview().textContent).toContain(
      "PushUpdate: a vote while you were away",
    );
    expect(within(preview()).getByText("4 members")).toBeTruthy();
    expect(within(preview()).getAllByText(/Not notified/)).toHaveLength(1);
  });

  it("counts the audience as picked, before it's saved", async () => {
    await renderDetails();
    await waitFor(() =>
      expect(countedAudiences).toEqual([
        { notifyType: "all_members", tagId: null },
      ]),
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Audience" }), {
      target: { value: "tag" },
    });

    expect(
      await screen.findByText("Pick a tag to count recipients."),
    ).toBeTruthy();
    expect(countedAudiences).toHaveLength(1);
  });

  it("keeps the action's events when its form variants fail to load", async () => {
    variantsAnswer = () =>
      Response.json({ statusCode: 500, message: "boom" }, { status: 500 });

    await renderDetails();

    expect(
      await screen.findByText(/The action's forms couldn't be loaded/),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: /^Launch/ })).toBeTruthy();
  });

  it("reads the questions of the action's variant forms", async () => {
    const formsRequested: string[] = [];
    variantsAnswer = () =>
      Response.json({
        variants: [
          {
            id: 1,
            actionId: 2,
            formId: 8,
            name: "Variant A",
            splitValue: 0.5,
            createdAt: "2026-10-01T00:00:00.000Z",
            updatedAt: "2026-10-01T00:00:00.000Z",
          },
        ],
        stats: [],
      });
    api.alsoServing({
      "GET /tasks/slug/:id": ({ params }) => {
        formsRequested.push(params.id);
        return Response.json({
          id: Number(params.id),
          title: "Survey",
          formSnapshotId: 7,
          schema: { pages: [], outputViews: [] },
        });
      },
    });

    await renderDetails();

    await waitFor(() => expect(formsRequested).toContain("8"));
    expect(screen.queryByText(/This action has no form/)).toBeNull();
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

  it("shows another admin's change to unedited details after a reload", async () => {
    await renderDetails();
    await screen.findByText("Nobody resolves.");

    served = update({ title: "Changed elsewhere" });

    await waitFor(() =>
      expect(screen.getAllByRole("textbox")[0]).toHaveProperty(
        "value",
        "Changed elsewhere",
      ),
    );
    expect(screen.queryByText(/Save your changes/)).toBeNull();
  });

  it("keeps unsaved edits across a reload", async () => {
    await renderDetails();
    await screen.findByText("Nobody resolves.");
    const [title] = screen.getAllByRole("textbox");
    fireEvent.change(title, { target: { value: "Edited" } });

    served = update({ title: "Changed elsewhere" });

    await waitFor(() =>
      expect(screen.queryByText("Nobody resolves.")).toBeNull(),
    );
    expect(screen.getAllByRole("textbox")[0]).toHaveProperty("value", "Edited");
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
