import { fireEvent, screen, waitFor } from "@testing-library/react";
import { actionUpdateAdmin as update } from "../../../lib/testing/actionUpdateAdmin";
import { HELD_POLL_MS } from "../../../lib/useActionUpdateAdmin";
import { setupTaskUpdatePage } from "./taskUpdatePageHarness";

const { state, api, renderDetails } = setupTaskUpdatePage();

describe("while an update's notifications are on hold", () => {
  const SENDABLE =
    "Nothing has been sent yet. Members are notified when you send it.";
  const realSetInterval = globalThis.setInterval;

  beforeEach(() => {
    state.served = update({ notificationHeldReason: "Nobody resolves." });
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

    state.served = update({
      recognitionPreparedAt: "2026-10-01T00:00:00.000Z",
    });

    await waitFor(() =>
      expect(screen.queryByText("Nobody resolves.")).toBeNull(),
    );
  });

  it("shows another admin's change to unedited details after a reload", async () => {
    await renderDetails();
    await screen.findByText("Nobody resolves.");

    state.served = update({ title: "Changed elsewhere" });

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

    state.served = update({ title: "Changed elsewhere" });

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
        const before = state.served;
        pollWaiting = true;
        await new Promise<void>((release) => (releasePoll = release));
        return Response.json(before);
      },
      "PATCH /actions/updateUpdate/:id": async ({ request }) => {
        state.served = { ...state.served, ...(await request.json()) };
        return Response.json(state.served);
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
        const before = state.served;
        pollWaiting = true;
        await new Promise<void>((release) => (releasePoll = release));
        return Response.json(before);
      },
      "PATCH /actions/updateUpdate/:id": async ({ request }) => {
        state.served = { ...state.served, ...(await request.json()) };
        saveWaiting = true;
        await new Promise<void>((release) => (releaseSave = release));
        return Response.json(state.served);
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
