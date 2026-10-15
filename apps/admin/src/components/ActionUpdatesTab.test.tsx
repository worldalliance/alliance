import type { ActionUpdateDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { useQuery } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import ActionUpdatesTab from "./ActionUpdatesTab";

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

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

const renderTab = (
  updates: ActionUpdateDto[] = [],
  params: { actionReloadHangs?: boolean } = {},
) => {
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.actionAdmin(4), null);
  const tab = (
    <ActionUpdatesTab
      actionId={4}
      updates={updates}
      events={[]}
      availableTags={[]}
    />
  );
  render(
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
        <Route path="/actions/4/updates/9" element={<p>Update 9</p>} />
      </Routes>
    </MemoryRouter>,
    { wrapper: query.wrapper },
  );
  const actionInvalidated = () =>
    query.client.getQueryState(queryKeys.actionAdmin(4))?.isInvalidated;
  return { client: query.client, actionInvalidated };
};

const createUpdate = (
  params: { mode?: string; actionReloadHangs?: boolean } = {},
) => {
  const tab = renderTab([], params);
  fireEvent.change(screen.getByPlaceholderText("Title..."), {
    target: { value: "Hearing scheduled" },
  });
  fireEvent.change(screen.getByPlaceholderText("Notification message"), {
    target: { value: "a hearing on the bill" },
  });
  if (params.mode) {
    fireEvent.change(
      screen.getByRole("combobox", { name: /Recognition copy/ }),
      { target: { value: params.mode } },
    );
  }
  fireEvent.click(
    screen.getByRole("button", { name: "Create and write content" }),
  );
  return tab;
};

const refusing = (status: number, message: string) => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  answer = () => Response.json({ statusCode: status, message }, { status });
};

describe("ActionUpdatesTab", () => {
  it("refreshes the action and opens the created update", async () => {
    answer = () =>
      Response.json(
        { id: 9, actionId: 4, title: "Hearing scheduled" },
        { status: 201 },
      );

    const { actionInvalidated } = createUpdate();

    expect(await screen.findByText("Update 9")).toBeTruthy();
    expect(actionInvalidated()).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("opens the created update without waiting for the action to reload", async () => {
    answer = () =>
      Response.json({ id: 9, actionId: 4, title: "Hearing" }, { status: 201 });

    createUpdate({ actionReloadHangs: true });

    expect(await screen.findByText("Update 9")).toBeTruthy();
  });

  it("creates the update in the recognition mode picked", async () => {
    let body: unknown;
    answer = async (request) => {
      body = await request.json();
      return Response.json({ id: 9 }, { status: 201 });
    };

    createUpdate({ mode: "retrospective" });

    expect(await screen.findByText("Update 9")).toBeTruthy();
    expect(body).toMatchObject({ notificationMode: "retrospective" });
  });

  it("previews a split result as it's typed, and creates it split", async () => {
    let body: unknown;
    answer = async (request) => {
      body = await request.json();
      return Response.json({ id: 9 }, { status: 201 });
    };
    renderTab();
    fireEvent.change(screen.getByPlaceholderText("Title..."), {
      target: { value: "Hearing scheduled" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Split by who completed the action",
      }),
    );
    const create = screen.getByRole("button", {
      name: "Create and write content",
    });
    expect(screen.getByText("Write at least one group's result.")).toBeTruthy();
    expect(create).toHaveProperty("disabled", true);

    fireEvent.change(
      screen.getByRole("textbox", { name: /^Didn't complete the action/ }),
      { target: { value: "a hearing; there's still time" } },
    );

    expect(document.body.textContent).toContain(
      "PushUpdate: a hearing; there's still time",
    );
    expect(screen.getAllByText(/Not notified/)).toHaveLength(3);
    expect(screen.queryByText(/^\d+ members?$/)).toBeNull();
    fireEvent.click(create);
    expect(await screen.findByText("Update 9")).toBeTruthy();
    expect(body).toMatchObject({
      shortNotifString: "",
      splitCollectiveResult: true,
      nonCompleterResult: "a hearing; there's still time",
      uninvolvedResult: null,
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

    expect((await screen.findByRole("alert")).textContent).toBe(
      "notificationMode must be one of",
    );
  });

  it("keeps a server error's own text out of the message", async () => {
    refusing(500, "Internal server error");

    createUpdate();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Couldn't create the update.",
    );
  });

  it("says the create failed when the request doesn't go through", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    answer = () => {
      throw new TypeError("network down");
    };

    createUpdate();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Couldn't create the update.",
    );
  });
});

describe("deleting an update", () => {
  afterEach(() => {
    deleteAnswer = () => Response.json({});
  });

  const deleteExisting = (params: { actionReloadHangs?: boolean } = {}) => {
    const tab = renderTab([existing], params);
    tab.client.setQueryData(queryKeys.actionUpdateAdmin(7), existing);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    return tab;
  };

  it("drops the cached update and refreshes the action", async () => {
    const { client, actionInvalidated } = deleteExisting();

    await waitFor(() => expect(actionInvalidated()).toBe(true));
    expect(client.getQueryData(queryKeys.actionUpdateAdmin(7))).toBeUndefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("hides the delete while it's in flight", async () => {
    let release = () => {};
    deleteAnswer = async () => {
      await new Promise<void>((resolve) => (release = resolve));
      return Response.json({});
    };

    const { actionInvalidated } = deleteExisting();

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Delete" })).toBeNull(),
    );
    release();
    await waitFor(() => expect(actionInvalidated()).toBe(true));
  });

  it("keeps the delete hidden until the action has reloaded", async () => {
    let deleted = false;
    deleteAnswer = () => {
      deleted = true;
      return Response.json({});
    };

    deleteExisting({ actionReloadHangs: true });
    await waitFor(() => expect(deleted).toBe(true));
    await Bun.sleep(30);

    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("keeps each delete hidden while overlapping deletes are in flight", async () => {
    deleteAnswer = () => new Promise<Response>(() => {});
    renderTab([existing, { ...existing, id: 8, title: "Older news" }]);

    const [first, second] = screen.getAllByRole("button", { name: "Delete" });
    fireEvent.click(first);
    fireEvent.click(second);

    await waitFor(() =>
      expect(screen.queryAllByRole("button", { name: "Delete" })).toHaveLength(
        0,
      ),
    );
  });

  it("treats an update already deleted elsewhere as deleted", async () => {
    deleteAnswer = () => Response.json({ statusCode: 404 }, { status: 404 });

    const { actionInvalidated } = deleteExisting();

    await waitFor(() => expect(actionInvalidated()).toBe(true));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says why the server refused the delete and keeps the update", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    deleteAnswer = () =>
      Response.json(
        { statusCode: 403, message: "Not allowed" },
        { status: 403 },
      );

    const { client, actionInvalidated } = deleteExisting();

    expect((await screen.findByRole("alert")).textContent).toBe("Not allowed");
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
    expect(client.getQueryData(queryKeys.actionUpdateAdmin(7))).toEqual(
      existing,
    );
    expect(actionInvalidated()).toBe(false);
  });
});
