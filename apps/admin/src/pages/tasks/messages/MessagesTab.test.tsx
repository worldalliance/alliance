import type { ActionUpdateDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { useQuery } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { SAVE_FAILED_FALLBACK } from "../../../ui/templates/Form";
import { ToastProvider } from "../../../ui/ToastProvider";
import { TaskMessages } from "./MessagesTab";

let answer: (request: Request) => Response | Promise<Response> = () =>
  Response.json({});
let deleteAnswer: () => Response | Promise<Response> = () => Response.json({});

serveApi(
  routes({
    "POST /actions/createUpdate/:id": ({ request }) => answer(request),
    "DELETE /actions/deleteUpdate/:id": () => deleteAnswer(),
  }),
);

const existing: ActionUpdateDto = {
  id: 7,
  actionId: 4,
  title: "Old news",
  schemaSnapshotId: 1,
  cardImage: null,
  date: "2026-10-01T00:00:00.000Z",
  visibleAt: "2026-10-01T00:00:00.000Z",
  shortNotifString: "old news",
  associatedEventId: null,
  notifyType: "none",
  notifiedAt: null,
  schema: { blocks: [] },
};

const HangingActionReload = ({ children }: { children: ReactNode }) => {
  useQuery({
    queryKey: queryKeys.actionAdmin(4),
    queryFn: () => new Promise<null>(() => {}),
    staleTime: Infinity,
  });
  return children;
};

// ToastProvider keeps an empty alert region of its own, outside the tab.
const tabAlert = () => {
  const tab = screen.queryByTestId("tab");
  return tab ? (within(tab).queryAllByRole("alert")[0] ?? null) : null;
};
const findTabAlert = () =>
  waitFor(() => {
    const alert = tabAlert();
    if (!alert) throw new Error("no alert in the tab");
    return alert;
  });

const renderTab = (
  updates: ActionUpdateDto[] = [],
  params: { actionReloadHangs?: boolean } = {},
) => {
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.actionAdmin(4), null);
  const setError = jest.fn();
  const tab = (
    <div data-testid="tab">
      <TaskMessages
        actionId={4}
        updates={updates}
        events={[]}
        tags={[]}
        suiteId={null}
        openFollowUpForms={() => {}}
        setError={setError}
      />
    </div>
  );
  render(
    <ToastProvider>
      <MemoryRouter>
        <Routes>
          <Route
            path="/"
            element={
              params.actionReloadHangs ? (
                <HangingActionReload>{tab}</HangingActionReload>
              ) : (
                tab
              )
            }
          />
          <Route path="/tasks/4/updates/9" element={<p>Update 9</p>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
    { wrapper: query.wrapper },
  );
  const actionInvalidated = () =>
    query.client.getQueryState(queryKeys.actionAdmin(4))?.isInvalidated;
  return { client: query.client, actionInvalidated, setError };
};

const createUpdate = (params: { actionReloadHangs?: boolean } = {}) => {
  const tab = renderTab([], params);
  fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
    target: { value: "Hearing scheduled" },
  });
  fireEvent.change(
    screen.getByRole("textbox", {
      name: "Notification text for members who completed",
    }),
    { target: { value: "a hearing on the bill" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Create and write content" }),
  );
  return tab;
};

const refusing = (status: number, message: string) => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  answer = () => Response.json({ statusCode: status, message }, { status });
};

describe("MessagesTab", () => {
  it("refreshes the action and opens the created update", async () => {
    answer = () =>
      Response.json(
        { id: 9, actionId: 4, title: "Hearing scheduled" },
        { status: 201 },
      );

    const { actionInvalidated } = createUpdate();

    expect(await screen.findByText("Update 9")).toBeTruthy();
    expect(actionInvalidated()).toBe(true);
    expect(tabAlert()).toBeNull();
  });

  it("opens the created update without waiting for the action to reload", async () => {
    answer = () =>
      Response.json({ id: 9, actionId: 4, title: "Hearing" }, { status: 201 });

    createUpdate({ actionReloadHangs: true });

    expect(await screen.findByText("Update 9")).toBeTruthy();
  });

  it("creates the update with the collective result as written", async () => {
    let body: unknown;
    answer = async (request) => {
      body = await request.json();
      return Response.json({ id: 9 }, { status: 201 });
    };

    createUpdate();

    expect(await screen.findByText("Update 9")).toBeTruthy();
    expect(body).toMatchObject({ shortNotifString: "a hearing on the bill" });
    expect(body).not.toHaveProperty("notificationMode");
  });

  it("previews both notif texts as they're typed, and creates them", async () => {
    let body: unknown;
    answer = async (request) => {
      body = await request.json();
      return Response.json({ id: 9 }, { status: 201 });
    };
    renderTab();
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "Hearing scheduled" },
    });
    fireEvent.change(screen.getByDisplayValue("No notification"), {
      target: { value: "all_members" },
    });
    const create = screen.getByRole("button", {
      name: "Create and write content",
    });
    expect(screen.getByText("Write at least one group's result.")).toBeTruthy();
    fireEvent.click(create);
    expect(
      screen.getByText(
        `Couldn't create: Write at least one group's result. Or set the audience to "No notification".`,
      ),
    ).toBeTruthy();
    expect(body).toBeUndefined();

    fireEvent.change(
      screen.getByRole("textbox", {
        name: /^Notification text for members who didn't complete/,
      }),
      { target: { value: "a hearing; there's still time" } },
    );

    expect(document.body.textContent).toContain(
      "PushUpdate: a hearing; there's still time",
    );
    expect(screen.getAllByText(/Not notified/)).toHaveLength(1);
    expect(screen.queryByText(/^\d+ members?$/)).toBeNull();
    fireEvent.click(create);
    expect(await screen.findByText("Update 9")).toBeTruthy();
    expect(body).toMatchObject({
      shortNotifString: "",
      nonCompleterResult: "a hearing; there's still time",
    });
  });

  it("sends one create while the first is in flight", async () => {
    let requests = 0;
    answer = async () => {
      requests++;
      await Bun.sleep(20);
      return Response.json({ id: 9 }, { status: 201 });
    };

    createUpdate();
    fireEvent.click(
      screen.getByRole("button", { name: "Create and write content" }),
    );

    expect(await screen.findByText("Update 9")).toBeTruthy();
    expect(requests).toBe(1);
  });

  it("says why the server refused a new update", async () => {
    refusing(400, "notificationMode must be one of");

    createUpdate();

    expect((await findTabAlert()).textContent).toBe(
      "Couldn't create: notificationMode must be one of",
    );
  });

  it("keeps a server error's own text out of the message", async () => {
    refusing(500, "Internal server error");

    createUpdate();

    expect((await findTabAlert()).textContent).toBe(
      `Couldn't create: ${SAVE_FAILED_FALLBACK}`,
    );
  });

  it("says the create failed when the request doesn't go through", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    answer = () => {
      throw new TypeError("network down");
    };

    createUpdate();

    expect((await findTabAlert()).textContent).toBe(
      `Couldn't create: ${SAVE_FAILED_FALLBACK}`,
    );
  });
});

const DELETE = { name: /^Delete: / };
const deleteBusy = () =>
  screen
    .getAllByRole("button", DELETE)
    .map((button) => button.getAttribute("aria-busy") === "true");

const clickDelete = (button: HTMLElement) => {
  fireEvent.click(button);
  fireEvent.click(screen.getByRole("button", { name: "Delete update" }));
};

describe("deleting an update", () => {
  afterEach(() => {
    deleteAnswer = () => Response.json({});
  });

  const deleteExisting = (params: { actionReloadHangs?: boolean } = {}) => {
    const tab = renderTab([existing], params);
    tab.client.setQueryData(queryKeys.actionUpdateAdmin(7), existing);
    clickDelete(screen.getByRole("button", DELETE));
    return tab;
  };

  it("asks before deleting, and keeps the update on cancel", async () => {
    let deleted = false;
    deleteAnswer = () => {
      deleted = true;
      return Response.json({});
    };
    renderTab([existing]);

    fireEvent.click(screen.getByRole("button", DELETE));
    expect(
      screen.getByText("Delete the project update “Old news”?"),
    ).toBeTruthy();
    expect(screen.getByText("Members stop seeing it.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await Bun.sleep(30);

    expect(deleted).toBe(false);
    expect(deleteBusy()).toEqual([false]);
  });

  it("drops the cached update and refreshes the action", async () => {
    const { client, actionInvalidated, setError } = deleteExisting();

    await waitFor(() => expect(actionInvalidated()).toBe(true));
    expect(client.getQueryData(queryKeys.actionUpdateAdmin(7))).toBeUndefined();
    expect(setError.mock.calls).toEqual([[null]]);
  });

  it("holds the delete busy while it's in flight", async () => {
    let release = () => {};
    deleteAnswer = async () => {
      await new Promise<void>((resolve) => (release = resolve));
      return Response.json({});
    };

    const { actionInvalidated } = deleteExisting();

    await waitFor(() => expect(deleteBusy()).toEqual([true]));
    release();
    await waitFor(() => expect(actionInvalidated()).toBe(true));
  });

  it("keeps the delete busy until the action has reloaded", async () => {
    let deleted = false;
    deleteAnswer = () => {
      deleted = true;
      return Response.json({});
    };

    deleteExisting({ actionReloadHangs: true });
    await waitFor(() => expect(deleted).toBe(true));
    await Bun.sleep(30);

    expect(deleteBusy()).toEqual([true]);
  });

  it("keeps each delete busy while overlapping deletes are in flight", async () => {
    deleteAnswer = () => new Promise<Response>(() => {});
    renderTab([existing, { ...existing, id: 8, title: "Older news" }]);

    const [first, second] = screen.getAllByRole("button", DELETE);
    clickDelete(first);
    await waitFor(() => expect(deleteBusy()).toEqual([true, false]));
    clickDelete(second);

    await waitFor(() => expect(deleteBusy()).toEqual([true, true]));
  });

  it("treats an update already deleted elsewhere as deleted", async () => {
    deleteAnswer = () => Response.json({ statusCode: 404 }, { status: 404 });

    const { actionInvalidated, setError } = deleteExisting();

    await waitFor(() => expect(actionInvalidated()).toBe(true));
    expect(setError.mock.calls).toEqual([[null]]);
  });

  it("says why the server refused the delete and keeps the update", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    deleteAnswer = () =>
      Response.json(
        { statusCode: 403, message: "Not allowed" },
        { status: 403 },
      );

    const { client, actionInvalidated, setError } = deleteExisting();

    await waitFor(() =>
      expect(setError).toHaveBeenLastCalledWith("Not allowed"),
    );
    expect(deleteBusy()).toEqual([false]);
    expect(client.getQueryData(queryKeys.actionUpdateAdmin(7))).toEqual(
      existing,
    );
    expect(actionInvalidated()).toBe(false);
  });
});

it("creates an update with no notification without notification text", async () => {
  let created = false;
  answer = () => {
    created = true;
    return Response.json({ id: 9 }, { status: 201 });
  };
  renderTab();
  fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
    target: { value: "Quiet update" },
  });
  const create = screen.getByRole("button", {
    name: "Create and write content",
  });

  expect(create).toHaveProperty("disabled", false);
  fireEvent.click(create);
  await waitFor(() => expect(created).toBe(true));
});

it("asks for a title instead of creating, until one is typed", async () => {
  let requests = 0;
  answer = () => {
    requests += 1;
    return Response.json({ id: 9 }, { status: 201 });
  };
  renderTab();

  fireEvent.click(
    screen.getByRole("button", { name: "Create and write content" }),
  );
  expect(screen.getByText("Couldn't create: Add a title.")).toBeTruthy();
  expect(requests).toBe(0);

  fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
    target: { value: "Quiet update" },
  });
  expect(screen.queryByText(/Add a title\./)).toBeNull();
});

it("asks for the tag when the audience is a tag", () => {
  renderTab();
  fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
    target: { value: "Tagged update" },
  });
  fireEvent.change(screen.getByDisplayValue("No notification"), {
    target: { value: "tag" },
  });
  fireEvent.change(
    screen.getByRole("textbox", {
      name: /^Notification text for members who didn't complete/,
    }),
    { target: { value: "a hearing on the bill" } },
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Create and write content" }),
  );

  expect(
    screen.getByText("Couldn't create: Pick the tag to notify."),
  ).toBeTruthy();
});

it("names every missing field at once", () => {
  renderTab();
  fireEvent.change(screen.getByDisplayValue("No notification"), {
    target: { value: "tag" },
  });
  fireEvent.change(
    screen.getByRole("textbox", {
      name: /^Notification text for members who didn't complete/,
    }),
    { target: { value: "a hearing on the bill" } },
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Create and write content" }),
  );

  expect(
    screen.getByText("Couldn't create: Add a title. Pick the tag to notify."),
  ).toBeTruthy();
});

it("asks for a date once the date is cleared", () => {
  renderTab();
  fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
    target: { value: "Undated update" },
  });
  fireEvent.change(document.querySelector('input[type="datetime-local"]')!, {
    target: { value: "" },
  });

  fireEvent.click(
    screen.getByRole("button", { name: "Create and write content" }),
  );

  expect(screen.getByText("Couldn't create: Pick a date.")).toBeTruthy();
});

it("lists the newest update first", () => {
  renderTab([
    {
      ...existing,
      id: 8,
      title: "Older news",
      date: "2026-01-01T00:00:00.000Z",
    },
    {
      ...existing,
      id: 9,
      title: "Newer news",
      date: "2026-03-01T00:00:00.000Z",
    },
  ]);

  expect(
    screen
      .getAllByRole("link", { name: /^Edit: / })
      .map((l) => l.getAttribute("aria-label")),
  ).toEqual(["Edit: Newer news", "Edit: Older news"]);
});

it("names each update's edit link after its update", () => {
  renderTab([existing, { ...existing, id: 8, title: "Older news" }]);

  expect(
    screen.getByRole("link", { name: "Edit: Older news" }).getAttribute("href"),
  ).toBe("/tasks/4/updates/8");
});

it("points to the suite's reminders and the follow-up forms, without composing them", () => {
  const openFollowUpForms = jest.fn();
  render(
    <ToastProvider>
      <MemoryRouter>
        <TaskMessages
          actionId={4}
          updates={[]}
          events={[]}
          tags={[]}
          suiteId={12}
          openFollowUpForms={openFollowUpForms}
          setError={() => {}}
        />
      </MemoryRouter>
    </ToastProvider>,
    { wrapper: queryWrapper().wrapper },
  );

  expect(
    screen
      .getByRole("link", { name: "Open the suite's reminders" })
      .getAttribute("href"),
  ).toBe("/tasks/suites/12?tab=reminders");
  fireEvent.click(screen.getByRole("button", { name: "Open follow-up forms" }));
  expect(openFollowUpForms).toHaveBeenCalled();
  expect(screen.getByText("No project updates yet")).toBeTruthy();
});
