import type { AdminActionUpdateDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import LeaveGuard from "../components/LeaveGuard";
import { notifyRealMembersText } from "../lib/notifyRealMembers";
import { actionUpdateAdmin as update } from "../lib/testing/actionUpdateAdmin";
import { HELD_POLL_MS } from "../lib/useActionUpdateAdmin";
import { ToastProvider } from "../ui/ToastProvider";
import ActionUpdatePage from "./ActionUpdatePage";

let served: AdminActionUpdateDto = update();
let countedAudiences: unknown[] = [];

const api = serveApi(
  routes({
    "GET /actions/updates/admin/:id": () => Response.json(served),
    "GET /actions/adminslug/:id": () =>
      Response.json({
        id: 2,
        taskFormId: null,
        taskKind: "form",
        events: [
          {
            id: 5,
            title: "Launch",
            date: "2026-09-01T00:00:00.000Z",
          },
        ],
      }),
    "GET /user/tags": () => Response.json([]),
    "GET /tasks/listForms": () => Response.json([]),
    "POST /actions/updates/:id/recognition-preview-counts": async ({
      request,
    }) => {
      countedAudiences.push(await request.json());
      return Response.json({
        completed: 2,
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
        element: (
          <LeaveGuard>
            <ActionUpdatePage />
          </LeaveGuard>
        ),
      },
      { path: "/actions/:actionId", element: <p>Action page</p> },
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
  return router;
};

const renderDetails = async () => {
  renderPage();
  fireEvent.click(
    await screen.findByRole("button", { name: "Update details" }),
  );
};

describe("ActionUpdatePage", () => {
  beforeEach(() => {
    served = update();
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
    expect(screen.queryByRole("button", { name: "Update details" })).toBeNull();

    release();
    fireEvent.click(
      await screen.findByRole("button", { name: "Update details" }),
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
    expect(screen.queryByRole("button", { name: "Update details" })).toBeNull();
  });

  it("offers the action's events to link the update to", async () => {
    await renderDetails();

    expect(
      await screen.findByRole("option", { name: /^Launch – / }),
    ).toBeTruthy();
  });

  it("says the action's events failed to load in place of the picker", async () => {
    api.alsoServing({
      "GET /actions/adminslug/:id": () =>
        Response.json({ statusCode: 500 }, { status: 500 }),
    });

    await renderDetails();

    expect(
      await screen.findByText("Couldn't load the action's events."),
    ).toBeTruthy();
    expect(screen.queryByRole("option", { name: /^Launch/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Send notification" }),
    ).toBeTruthy();
  });

  it("says why the server refused a notification", async () => {
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
    const text = notifyRealMembersText("many");
    fireEvent.change(await screen.findByPlaceholderText(text), {
      target: { value: text },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Already notified")).toBeTruthy();
  });

  it("sends no notification when staff cancel the confirmation", async () => {
    let sends = 0;
    api.alsoServing({
      "POST /actions/updates/:id/notify": () => {
        sends += 1;
        return Response.json(served);
      },
    });
    await renderDetails();

    fireEvent.click(screen.getByRole("button", { name: "Send notification" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByText("Send notification?")).toBeNull(),
    );
    expect(sends).toBe(0);
  });

  it("withdraws the confirmation, sending nothing, when staff go to another update", async () => {
    let sends = 0;
    api.alsoServing({
      "POST /actions/updates/:id/notify": () => {
        sends += 1;
        return Response.json(served);
      },
    });
    const router = renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: /^update details$/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Send notification" }));
    expect(await screen.findByText("Send notification?")).toBeTruthy();

    await router.navigate("/actions/2/updates/2");

    await waitFor(() =>
      expect(screen.queryByText("Send notification?")).toBeNull(),
    );
    expect(sends).toBe(0);
  });

  it("confirms a saved change with a toast", async () => {
    api.alsoServing({
      "PATCH /actions/updateUpdate/:id": () => Response.json(served),
    });
    await renderDetails();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText(`Saved "${served.title}"`)).toBeTruthy();
  });

  it("announces a refused save as an alert", async () => {
    api.alsoServing({
      "PATCH /actions/updateUpdate/:id": () =>
        Response.json({ message: "Nope" }, { status: 500 }),
    });
    await renderDetails();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      (await screen.findByText("Failed to save update")).getAttribute("role"),
    ).toBe("alert");
  });

  it("shows no recognition copy for a legacy update", async () => {
    served = update({ notificationMode: "legacy" });

    await renderDetails();

    expect(screen.queryByText("Preview update")).toBeNull();
    expect(
      screen.queryByRole("textbox", {
        name: /^Notif text for people who didn't complete/,
      }),
    ).toBeNull();
  });

  it("offers both notif texts until each member's copy is frozen", async () => {
    await renderDetails();

    expect(
      screen.getByRole("textbox", {
        name: "Notif text for people who completed",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("textbox", {
        name: /^Notif text for people who didn't complete/,
      }),
    ).toBeTruthy();
  });

  it("keeps the notif texts once copy is frozen and hides the preview", async () => {
    served = update({
      notifiedAt: "2026-10-01T00:00:00.000Z",
      recognitionPreparedAt: "2026-10-01T00:00:00.000Z",
    });

    await renderDetails();

    expect(await screen.findByText(/copy was frozen/)).toBeTruthy();
    expect(
      screen.getByRole("textbox", {
        name: "Notif text for people who completed",
      }),
    ).toBeTruthy();
    expect(screen.queryByText("Preview update")).toBeNull();
    expect(countedAudiences).toEqual([]);
  });

  it("previews every variation as the notif texts are typed", async () => {
    await renderDetails();
    const preview = () =>
      screen.getByText("Preview update").closest("div.border") as HTMLElement;

    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Notif text for people who completed",
      }),
      { target: { value: "a vote" } },
    );
    expect(preview().textContent).toContain("PushUpdate: a vote");
    expect(await within(preview()).findByText("2 members")).toBeTruthy();

    fireEvent.change(
      screen.getByRole("textbox", {
        name: /^Notif text for people who didn't complete/,
      }),
      { target: { value: "a vote while you were away" } },
    );

    expect(preview().textContent).toContain(
      "PushUpdate: a vote while you were away",
    );
    expect(within(preview()).getByText("7 members")).toBeTruthy();
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

  it("asks before saving a worldalliance title, saving only on Save anyway", async () => {
    let writes = 0;
    let titleSaved: string | null = null;
    api.alsoServing({
      "PATCH /actions/updateUpdate/:id": async ({ request }) => {
        writes += 1;
        const body: { title: string } = await request.json();
        titleSaved = body.title;
        return Response.json(served);
      },
    });
    await renderDetails();
    const title = await screen.findByDisplayValue("Hearing");
    const saveAs = async (value: string, choice: string) => {
      fireEvent.change(title, { target: { value } });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
      fireEvent.click(await screen.findByRole("button", { name: choice }));
    };

    await saveAs("See worldalliance.org", "Cancel");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await saveAs("See worldalliance.org/b", "Save anyway");
    await waitFor(() => expect(titleSaved).toBe("See worldalliance.org/b"));
    expect(writes).toBe(1);
  });

  it("asks before leaving unsaved details, but not for a tab change", async () => {
    const leaveAsked = jest.spyOn(window, "confirm").mockReturnValue(false);
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: /^update details$/i }),
    );
    fireEvent.change(await screen.findByDisplayValue("Hearing"), {
      target: { value: "Hearing moved" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Content" }));
    expect(leaveAsked).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /back to updates/i }));
    await waitFor(() => expect(leaveAsked).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("heading", { name: "Hearing" })).toBeTruthy();
  });

  it("stops guarding discarded edits once staff leave for an update that fails to load", async () => {
    api.alsoServing({
      "GET /actions/updates/admin/:id": ({ params }) =>
        params.id === "1"
          ? Response.json(served)
          : Response.json({ statusCode: 404 }, { status: 404 }),
    });
    const leaveAsked = jest.spyOn(window, "confirm").mockReturnValue(true);
    const router = renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: /^update details$/i }),
    );
    fireEvent.change(await screen.findByDisplayValue("Hearing"), {
      target: { value: "Hearing moved" },
    });

    await router.navigate("/actions/2/updates/2");
    expect(await screen.findByText("Update not found")).toBeTruthy();
    expect(leaveAsked).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(await screen.findByText("Action page")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/actions/2");
    expect(leaveAsked).toHaveBeenCalledTimes(1);
  });
});

describe("while an update's notifications are on hold", () => {
  const SENDABLE =
    "Nothing has been sent yet. Members are notified when you send it.";
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

    fireEvent.change(screen.getByDisplayValue("a hearing on the bill"), {
      target: { value: "a vote" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText(SENDABLE);
    releasePoll();
    await Bun.sleep(30);

    expect(screen.queryByText("Save your changes before sending.")).toBeNull();
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

    fireEvent.change(screen.getByDisplayValue("a hearing on the bill"), {
      target: { value: "a vote" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(saveWaiting).toBe(true));
    releaseSave();
    releasePoll();

    expect(await screen.findByText(SENDABLE)).toBeTruthy();
    await Bun.sleep(30);
    expect(screen.queryByText("Save your changes before sending.")).toBeNull();
  });
});
