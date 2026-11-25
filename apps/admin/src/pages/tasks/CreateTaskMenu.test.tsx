import { client } from "@alliance/shared/client/client.gen";
import { registerErrorStatus } from "@alliance/shared/lib/hey-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, jest, setSystemTime } from "bun:test";
import { createMemoryRouter, RouterProvider } from "react-router";
import { LAUNCH_CONFIRM_TEXT } from "../../components/CreateEventForm";
import { ToastProvider } from "../../ui/ToastProvider";
import { CreateTaskMenu } from "./CreateTaskMenu";

const { baseUrl, fetch } = client.getConfig();

registerErrorStatus(client);

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  client.setConfig({ baseUrl, fetch });
});

const exported = {
  name: "Call your rep",
  shortDescription: "Five minutes",
  suite: { name: "Fall push" },
  events: [
    { newStatus: "member_action", date: "2020-01-06T17:00:00.000Z" },
    { newStatus: "office_action", date: "2020-01-13T17:00:00.000Z" },
  ],
};

let sentBodies: unknown[] = [];

const serveCreated = () => {
  sentBodies = [];
  client.setConfig({
    baseUrl: "http://localhost",
    fetch: async (request: Request) => {
      const { body }: { body: string } = await request.json();
      sentBodies.push(JSON.parse(body));
      return Response.json({ id: 3, name: "Call your rep" });
    },
  });
};

const renderMenu = () => {
  const router = createMemoryRouter([
    { path: "/", element: <CreateTaskMenu /> },
    { path: "/tasks/:id", element: <p>Opened the pasted task</p> },
  ]);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

const openPaste = async (clipboard: unknown = exported) => {
  jest
    .spyOn(navigator.clipboard, "readText")
    .mockResolvedValue(JSON.stringify(clipboard));
  renderMenu();
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  fireEvent.click(await screen.findByText("Paste JSON…"));
  const dialog = await screen.findByRole("dialog", { name: "Paste a task" });
  await waitFor(() =>
    expect(
      within(dialog).getByRole<HTMLTextAreaElement>("textbox", {
        name: "Task JSON",
      }).value,
    ).not.toBe(""),
  );
  return dialog;
};

const createTask = (dialog: HTMLElement) =>
  fireEvent.click(within(dialog).getByRole("button", { name: "Create task" }));

it("opens the pasted task", async () => {
  serveCreated();
  createTask(await openPaste());

  expect(await screen.findByText("Opened the pasted task")).toBeTruthy();
  expect(screen.getByText("Task pasted")).toBeTruthy();
});

it("leaves the events out unless staff include them, and says what the paste creates", async () => {
  serveCreated();
  const dialog = await openPaste();

  expect(within(dialog).getByText("Creates “Call your rep”")).toBeTruthy();
  expect(
    within(dialog).getByText(
      "Adds it to the suite “Fall push”, or creates a suite with that name if there is none.",
    ),
  ).toBeTruthy();
  const include = within(dialog).getByRole<HTMLInputElement>("checkbox", {
    name: "Include its 2 events",
  });
  expect(include.checked).toBe(false);

  createTask(dialog);

  await screen.findByText("Opened the pasted task");
  expect(sentBodies).toEqual([
    {
      name: "Call your rep",
      shortDescription: "Five minutes",
      suite: { name: "Fall push" },
    },
  ]);
});

it("asks for the launch phrase before pasting a task with events, and sends nothing when declined", async () => {
  serveCreated();
  const dialog = await openPaste();
  fireEvent.click(
    within(dialog).getByRole("checkbox", { name: "Include its 2 events" }),
  );
  expect(
    within(dialog).getByText(
      /^It is “Office taking action” as soon as it is created/,
    ),
  ).toBeTruthy();

  createTask(dialog);
  const confirm = await screen.findByRole("dialog", {
    name: "Create a task that is live at once?",
  });
  expect(confirm.textContent).toContain(
    "This can't be undone: archiving or deleting the task later doesn't take back what members have seen.",
  );
  expect(confirm.textContent).toContain("This skips the suite launch checks.");
  fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", {
        name: "Create a task that is live at once?",
      }),
    ).toBeNull(),
  );
  expect(sentBodies).toEqual([]);
  await waitFor(() =>
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: "Create task" }),
    ),
  );

  createTask(dialog);
  const again = await screen.findByRole("dialog", {
    name: "Create a task that is live at once?",
  });
  fireEvent.change(within(again).getByPlaceholderText(LAUNCH_CONFIRM_TEXT), {
    target: { value: LAUNCH_CONFIRM_TEXT },
  });
  fireEvent.click(within(again).getByRole("button", { name: "Create task" }));

  await screen.findByText("Opened the pasted task");
  expect(sentBodies).toEqual([exported]);
});

it("doesn't call an archived paste irreversible, since no member sees it", async () => {
  serveCreated();
  const dialog = await openPaste({ ...exported, archived: true });
  fireEvent.click(
    within(dialog).getByRole("checkbox", { name: "Include its 2 events" }),
  );
  createTask(dialog);
  const confirm = await screen.findByRole("dialog", {
    name: "Create a task that is live at once?",
  });

  expect(confirm.textContent).toContain(
    "No member sees it while it is archived.",
  );
  expect(confirm.textContent).not.toContain("can't be undone");
});

it("refuses a paste whose scheduled event passed while the launch phrase was asked", async () => {
  serveCreated();
  const later = (minutes: number) => new Date(Date.now() + minutes * 60_000);
  const dialog = await openPaste({
    ...exported,
    suite: null,
    events: [{ newStatus: "member_action", date: later(5).toISOString() }],
  });
  fireEvent.click(
    within(dialog).getByRole("checkbox", { name: "Include its 1 event" }),
  );
  createTask(dialog);
  const confirm = await screen.findByRole("dialog", {
    name: "Create a task with a scheduled launch?",
  });
  expect(confirm.textContent).toContain(
    "Once it launches, this can't be undone",
  );
  expect(confirm.textContent).not.toContain("suite launch checks");

  setSystemTime(later(10));
  try {
    fireEvent.change(
      within(confirm).getByPlaceholderText(LAUNCH_CONFIRM_TEXT),
      { target: { value: LAUNCH_CONFIRM_TEXT } },
    );
    fireEvent.click(
      within(confirm).getByRole("button", { name: "Create task" }),
    );

    expect(
      await within(dialog).findByText(
        "An event's time passed before you confirmed. Check the events and create the task again.",
      ),
    ).toBeTruthy();
    expect(sentBodies).toEqual([]);
  } finally {
    setSystemTime();
  }
});

it("says an archived public-only task still opens from its link", async () => {
  serveCreated();
  const dialog = await openPaste({
    ...exported,
    archived: true,
    publicOnly: true,
  });
  fireEvent.click(
    within(dialog).getByRole("checkbox", { name: "Include its 2 events" }),
  );

  expect(
    within(dialog).getByText(
      /It is archived, but anyone with its link can still open its page\.$/,
    ),
  ).toBeTruthy();
  expect(
    within(dialog).queryByText(/No member sees it while it is archived/),
  ).toBeNull();
});

it("says what is wrong with JSON that isn't a task, and sends nothing", async () => {
  serveCreated();
  const dialog = await openPaste({ title: "Not a task" });

  createTask(dialog);

  expect(
    await within(dialog).findByText(
      "This JSON isn't a task export: it needs a name, and any events need a status and a date",
    ),
  ).toBeTruthy();
  expect(sentBodies).toEqual([]);
});

it("shows the server's reason for refusing a paste in the dialog", async () => {
  const reason = "Every Tag condition in the cohort must name an existing tag.";
  client.setConfig({
    baseUrl: "http://localhost",
    fetch: async () =>
      Response.json({ statusCode: 400, message: reason }, { status: 400 }),
  });
  const dialog = await openPaste();
  createTask(dialog);

  expect(await within(dialog).findByText(reason)).toBeTruthy();
});

it("lets staff paste by hand when the clipboard can't be read", async () => {
  jest
    .spyOn(navigator.clipboard, "readText")
    .mockRejectedValue(new DOMException("denied", "NotAllowedError"));
  serveCreated();
  renderMenu();
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  fireEvent.click(await screen.findByText("Paste JSON…"));
  const dialog = await screen.findByRole("dialog", { name: "Paste a task" });

  expect(
    await within(dialog).findByText(
      "Couldn't read the clipboard: paste the JSON here.",
    ),
  ).toBeTruthy();
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Task JSON" }), {
    target: { value: JSON.stringify({ name: "Call your rep" }) },
  });
  createTask(dialog);

  expect(await screen.findByText("Opened the pasted task")).toBeTruthy();
});

it("reports a rejected paste request and lets staff try again", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  client.setConfig({
    baseUrl: "http://localhost",
    fetch: () => Promise.reject(new TypeError("Failed to fetch")),
  });
  const dialog = await openPaste();
  createTask(dialog);

  expect(
    await within(dialog).findByText("Couldn't create the task."),
  ).toBeTruthy();
  const button = within(dialog).getByRole("button", { name: "Create task" });
  expect(button.getAttribute("aria-busy")).toBeNull();
});
