import type { ProjectDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ActionProjectControls } from "./ActionProjectControls";

let responses: Response[] = [];
let pending: Promise<Response> | null = null;

serveApi(
  routes({
    "GET /projects": () =>
      pending ?? responses.shift() ?? Response.json({}, { status: 500 }),
  }),
);

beforeEach(() => {
  pending = null;
});

const renderControls = (project: ProjectDto | null = null) => {
  const query = queryWrapper();
  render(
    <ToastProvider>
      <ActionProjectControls actionId={7} project={project} />
    </ToastProvider>,
    query,
  );
  return query.client;
};

const selectLocked = () =>
  screen.getByRole("combobox").hasAttribute("disabled") ||
  screen.getByRole("combobox").getAttribute("aria-disabled") === "true";

const ALERT =
  "Could not load the projects, so neither a project nor No project can be chosen.";

test("says the projects failed to load, locks the choice, and loads them again on Try again", async () => {
  responses = [];
  renderControls();

  const alert = await screen.findByText(ALERT, { exact: false });
  expect(alert.getAttribute("role")).toBe("alert");
  expect(selectLocked()).toBe(true);

  let respond = (_: Response) => {};
  pending = new Promise((resolve) => (respond = resolve));
  const retry = screen.getByRole("button", { name: "Try again" });
  act(() => retry.focus());
  fireEvent.click(retry);
  expect(await screen.findByText("Loading the projects…")).toBeTruthy();
  expect(document.activeElement).toBe(retry);

  respond(Response.json([]));
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("combobox")),
  );
  expect(selectLocked()).toBe(false);
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
});

test("leaves focus where it moved while the retry loaded", async () => {
  responses = [];
  render(
    <ToastProvider>
      <input aria-label="Title" />
      <ActionProjectControls actionId={7} project={null} />
    </ToastProvider>,
    queryWrapper(),
  );
  await screen.findByText(ALERT, { exact: false });

  let respond = (_: Response) => {};
  pending = new Promise((resolve) => (respond = resolve));
  const retry = screen.getByRole("button", { name: "Try again" });
  act(() => retry.focus());
  fireEvent.click(retry);
  await screen.findByText("Loading the projects…");
  const title = screen.getByRole("textbox", { name: "Title" });
  act(() => title.focus());

  respond(Response.json([]));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull(),
  );
  expect(document.activeElement).toBe(title);
});

test("keeps focus on Try again when the retry fails too", async () => {
  responses = [];
  renderControls();
  await screen.findByText(ALERT, { exact: false });

  let respond = (_: Response) => {};
  pending = new Promise((resolve) => (respond = resolve));
  const retry = screen.getByRole("button", { name: "Try again" });
  act(() => retry.focus());
  fireEvent.click(retry);
  await screen.findByText("Loading the projects…");
  respond(Response.json({}, { status: 500 }));
  expect(await screen.findByText(ALERT, { exact: false })).toBeTruthy();
  expect(document.activeElement).toBe(retry);
});

test.each([
  ["fails", () => Response.json({}, { status: 500 }), ALERT],
  ["succeeds", () => Response.json([]), null],
])(
  "keeps the alert up through a refetch Try again didn't start, which %s",
  async (_, answer, after) => {
    responses = [];
    const client = renderControls();
    await screen.findByText(ALERT, { exact: false });
    const retry = screen.getByRole("button", { name: "Try again" });
    act(() => retry.focus());

    let respond = (_: Response) => {};
    pending = new Promise((resolve) => (respond = resolve));
    const refetched = client.refetchQueries({
      queryKey: queryKeys.projectsAdmin(),
    });
    await screen.findByText("Loading the projects…");
    expect(document.activeElement).toBe(retry);

    respond(answer());
    if (after) {
      expect(await screen.findByText(after, { exact: false })).toBeTruthy();
      expect(document.activeElement).toBe(retry);
    } else {
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole("combobox")),
      );
    }
    await act(() => refetched);
  },
);

test("names the action's project while the list can't load", async () => {
  responses = [];
  renderControls({ id: 3, name: "Housing", category: [] });

  await screen.findByText(ALERT, { exact: false });
  expect(screen.getByRole("combobox").textContent).toBe("Housing");
});

test("keeps the choice open when a later refetch fails", async () => {
  responses = [Response.json([])];
  const client = renderControls();
  await waitFor(() => expect(selectLocked()).toBe(false));

  await act(() =>
    client.refetchQueries({ queryKey: queryKeys.projectsAdmin() }),
  );
  expect(client.getQueryState(queryKeys.projectsAdmin())?.status).toBe("error");
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(screen.queryByText(ALERT, { exact: false })).toBeNull();
  expect(selectLocked()).toBe(false);
});
