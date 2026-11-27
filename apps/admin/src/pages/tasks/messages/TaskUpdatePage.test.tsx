import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  setSystemTime,
} from "bun:test";
import { notifyRealMembersText } from "../../../lib/notifyRealMembers";
import { actionUpdateAdmin as update } from "../../../lib/testing/actionUpdateAdmin";
import { answerLeaveGuard } from "../../../lib/testing/leaveGuard";
import { SAVE_FAILED_FALLBACK } from "../../../ui/templates/Form";

import { setupTaskUpdatePage } from "./taskUpdatePageHarness";

const { state, api, renderPage, renderDetails } = setupTaskUpdatePage();

describe("TaskUpdatePage", () => {
  beforeEach(() => {
    state.served = update();
    state.countedAudiences = [];
  });

  afterEach(() => setSystemTime());

  it("says an update id that isn't a number isn't found", async () => {
    renderPage({ path: "/tasks/2/updates/abc" });

    expect(await screen.findByText("Project update not found")).toBeTruthy();
  });

  it("says a missing update wasn't found", async () => {
    api.alsoServing({
      "GET /actions/updates/admin/:id": () =>
        Response.json({ statusCode: 404 }, { status: 404 }),
    });

    renderPage();

    expect(await screen.findByText("Project update not found")).toBeTruthy();
  });

  it("says an update under another task's URL isn't found", async () => {
    renderPage({ path: "/tasks/3/updates/1" });

    expect(await screen.findByText("Project update not found")).toBeTruthy();
  });

  it("says the update failed to load on any other error", async () => {
    api.alsoServing({
      "GET /actions/updates/admin/:id": () =>
        Response.json({ statusCode: 500 }, { status: 500 }),
    });

    renderPage();

    expect(
      await screen.findByText("Couldn't load this project update"),
    ).toBeTruthy();
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

    expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Stale" })).toBeNull();

    release();
    expect(await screen.findByRole("heading", { name: "Fresh" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Details" }));
    expect(screen.getAllByRole("textbox")[0]).toHaveProperty("value", "Fresh");
  });

  it("says the update failed to load when a reload over a cached copy fails", async () => {
    api.alsoServing({
      "GET /actions/updates/admin/:id": () =>
        Response.json({ statusCode: 500 }, { status: 500 }),
    });

    renderPage({ cached: update() });

    expect(
      await screen.findByText("Couldn't load this project update"),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Hearing" })).toBeNull();
  });

  it("offers the task's events to link the update to", async () => {
    await renderDetails();

    expect(
      await screen.findByRole("option", { name: /^Launch – / }),
    ).toBeTruthy();
  });

  it("says the task's events failed to load in place of the picker", async () => {
    api.alsoServing({
      "GET /actions/adminslug/:id": () =>
        Response.json({ statusCode: 500 }, { status: 500 }),
    });

    await renderDetails();

    expect(
      await screen.findByText("Couldn't load the task's events."),
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

  it("says who the send reaches before sending", async () => {
    await renderDetails();

    fireEvent.click(screen.getByRole("button", { name: "Send notification" }));

    expect(
      await screen.findByText(
        /This notifies every member with an active contract/,
      ),
    ).toBeTruthy();
  });

  it("says before saving that a published update's changes reach members", async () => {
    state.served = update({ visibleAt: "2026-10-01T00:00:00.000Z" });

    await renderDetails();

    expect(
      screen.getByText("Members who can see the task see the changes at once."),
    ).toBeTruthy();
  });

  it("sends no notification when staff cancel the confirmation", async () => {
    let sends = 0;
    api.alsoServing({
      "POST /actions/updates/:id/notify": () => {
        sends += 1;
        return Response.json(state.served);
      },
    });
    await renderDetails();

    fireEvent.click(screen.getByRole("button", { name: "Send notification" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByText("Send the notification?")).toBeNull(),
    );
    expect(sends).toBe(0);
  });

  it("withdraws the confirmation, sending nothing, when staff go to another update", async () => {
    let sends = 0;
    api.alsoServing({
      "POST /actions/updates/:id/notify": () => {
        sends += 1;
        return Response.json(state.served);
      },
    });
    const router = renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "Details" }));
    fireEvent.click(screen.getByRole("button", { name: "Send notification" }));
    expect(await screen.findByText("Send the notification?")).toBeTruthy();

    await router.navigate("/tasks/2/updates/2");

    await waitFor(() =>
      expect(screen.queryByText("Send the notification?")).toBeNull(),
    );
    expect(sends).toBe(0);
  });

  it("confirms a saved change with a toast", async () => {
    api.alsoServing({
      "PATCH /actions/updateUpdate/:id": () => Response.json(state.served),
    });
    await renderDetails();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Project update saved")).toBeTruthy();
  });

  it("announces a refused save as an alert", async () => {
    api.alsoServing({
      "PATCH /actions/updateUpdate/:id": () =>
        Response.json({ message: "Nope" }, { status: 500 }),
    });
    await renderDetails();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      (
        await screen.findByText(`Couldn't save: ${SAVE_FAILED_FALLBACK}`)
      ).getAttribute("role"),
    ).toBe("alert");
  });

  it("says when a sent update went out, not to the audience saved since", async () => {
    setSystemTime(new Date("2026-08-01T00:00:00.000Z"));
    state.served = update({
      date: "2026-07-01T00:00:00.000Z",
      notifiedAt: "2026-07-03T00:32:00.000Z",
      notifyType: "none",
    });

    await renderDetails();

    expect(
      screen.getByText(/^Sent Jul 2, 5:32 PM PT\. An update can only be/),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Send notification/ }),
    ).toBeNull();
  });

  it("shows no recognition copy for a legacy update", async () => {
    state.served = update({ notificationMode: "legacy" });

    await renderDetails();

    expect(screen.queryByRole("region", { name: "Preview" })).toBeNull();
    expect(
      screen.queryByRole("textbox", {
        name: /^Notification text for members who didn't complete/,
      }),
    ).toBeNull();
  });

  it("offers both notif texts until each member's copy is frozen", async () => {
    await renderDetails();

    expect(
      screen.getByRole("textbox", {
        name: "Notification text for members who completed",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("textbox", {
        name: /^Notification text for members who didn't complete/,
      }),
    ).toBeTruthy();
  });

  it("keeps the notif texts once copy is frozen and hides the preview", async () => {
    state.served = update({
      notifiedAt: "2026-10-01T00:00:00.000Z",
      recognitionPreparedAt: "2026-10-01T00:00:00.000Z",
    });

    await renderDetails();

    expect(await screen.findByText(/copy was frozen/)).toBeTruthy();
    expect(
      screen.getByRole("textbox", {
        name: "Notification text for members who completed",
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Preview" })).toBeNull();
    expect(state.countedAudiences).toEqual([]);
  });

  it("previews every variation as the notif texts are typed", async () => {
    await renderDetails();
    const preview = () => screen.getByRole("region", { name: "Preview" });

    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Notification text for members who completed",
      }),
      { target: { value: "a vote" } },
    );
    expect(preview().textContent).toContain("PushUpdate: a vote");
    expect(await within(preview()).findByText("2 members")).toBeTruthy();

    fireEvent.change(
      screen.getByRole("textbox", {
        name: /^Notification text for members who didn't complete/,
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
      expect(state.countedAudiences).toEqual([
        { notifyType: "all_members", tagId: null },
      ]),
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Audience" }), {
      target: { value: "tag" },
    });

    expect(
      await screen.findByText("Pick a tag to count recipients."),
    ).toBeTruthy();
    expect(state.countedAudiences).toHaveLength(1);
  });

  it("asks before saving a worldalliance title, saving only on Save anyway", async () => {
    let writes = 0;
    let titleSaved: string | null = null;
    api.alsoServing({
      "PATCH /actions/updateUpdate/:id": async ({ request }) => {
        writes += 1;
        const body: { title: string } = await request.json();
        titleSaved = body.title;
        return Response.json(state.served);
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
    const leaveAsked = answerLeaveGuard(false);
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "Details" }));
    fireEvent.change(await screen.findByDisplayValue("Hearing"), {
      target: { value: "Hearing moved" },
    });

    fireEvent.click(screen.getByRole("tab", { name: "Content" }));
    expect(leaveAsked).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("link", { name: "Task" }));
    await waitFor(() => expect(leaveAsked).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("heading", { name: "Hearing" })).toBeTruthy();
  });

  it("stops guarding discarded edits once staff leave for an update that fails to load", async () => {
    api.alsoServing({
      "GET /actions/updates/admin/:id": ({ params }) =>
        params.id === "1"
          ? Response.json(state.served)
          : Response.json({ statusCode: 404 }, { status: 404 }),
    });
    const leaveAsked = answerLeaveGuard(true);
    const router = renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: "Details" }));
    fireEvent.change(await screen.findByDisplayValue("Hearing"), {
      target: { value: "Hearing moved" },
    });

    await router.navigate("/tasks/2/updates/2");
    expect(await screen.findByText("Project update not found")).toBeTruthy();
    expect(leaveAsked).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("link", { name: "Open the task's messages" }),
    );
    expect(await screen.findByText("Action page")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/tasks/2");
    expect(leaveAsked).toHaveBeenCalledTimes(1);
  });
});
