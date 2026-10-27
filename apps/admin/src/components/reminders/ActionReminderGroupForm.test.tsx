import {
  defaultPushMessage,
  defaultTextMessage,
} from "@alliance/common/reminderPresetCopy";
import { client } from "@alliance/shared/client/client.gen";
import { makeEvent } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactElement } from "react";
import ActionReminderGroupForm from "./ActionReminderGroupForm";

const { baseUrl, fetch } = client.getConfig();

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  client.setConfig({ baseUrl, fetch });
});

const isTentativeRequest = (request: Request) =>
  request.url.endsWith("/checkTentativePlans");

const tentativeRequests = (
  fetchMock: jest.Mock<Promise<Response>, [Request]>,
) =>
  fetchMock.mock.calls.map(([request]) => request).filter(isTentativeRequest);

const initialValues = {
  memberActionEventId: 3,
  reminderGroup: null,
  users: [],
};

const formElement = (suiteId: number, waitForRecipientCount = true) => (
  <ActionReminderGroupForm
    suiteId={suiteId}
    waitForRecipientCount={waitForRecipientCount}
    memberEvents={[makeEvent({ id: 3 })]}
    anchorCandidates={[]}
    users={[]}
    loadingUsers={false}
    usersLoadFailed={false}
    userTags={[]}
    loadingUserTags={false}
    initialValues={initialValues}
    onSubmit={() => {}}
  />
);

const mockFetch = (
  respond: (request: Request) => Promise<Response> = async () =>
    Response.json([], { status: 201 }),
) => {
  const fetchMock = jest.fn(respond);
  client.setConfig({ baseUrl: "http://localhost", fetch: fetchMock });
  return fetchMock;
};

const renderForm = (ui: ReactElement) => render(ui, queryWrapper());

const countError = "Unable to get tentative plans";

const plan = { scheduledFor: new Date(2030, 0, 1).toISOString() };

it("previews the group with its suite", async () => {
  const fetchMock = mockFetch();
  renderForm(formElement(7));

  await waitFor(() => expect(tentativeRequests(fetchMock)).toHaveLength(1));
  expect(await tentativeRequests(fetchMock)[0].clone().json()).toMatchObject({
    suiteId: 7,
  });
});

it("sends one preview request for a burst of changes", async () => {
  const fetchMock = mockFetch();
  const { rerender } = renderForm(formElement(7));
  await new Promise((resolve) => setTimeout(resolve, 100));
  rerender(formElement(8));
  await new Promise((resolve) => setTimeout(resolve, 100));
  rerender(formElement(9));

  await waitFor(() => expect(tentativeRequests(fetchMock)).toHaveLength(1));
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect(tentativeRequests(fetchMock)).toHaveLength(1);
  expect(await tentativeRequests(fetchMock)[0].clone().json()).toMatchObject({
    suiteId: 9,
  });
});

it("ignores a preview response superseded by a newer change", async () => {
  let resolveFirst: (response: Response) => void = () => {};
  const fetchMock = mockFetch((request) => {
    if (!isTentativeRequest(request)) {
      return Promise.resolve(Response.json([], { status: 201 }));
    }
    if (tentativeRequests(fetchMock).length === 1) {
      return new Promise<Response>((resolve) => {
        resolveFirst = resolve;
      });
    }
    return Promise.resolve(Response.json([plan], { status: 201 }));
  });
  const { rerender } = renderForm(formElement(7));
  await waitFor(() => expect(tentativeRequests(fetchMock)).toHaveLength(1));

  rerender(formElement(8));
  await screen.findByText("1");
  resolveFirst(Response.json([plan, plan, plan], { status: 201 }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.queryByText("3")).toBeNull();
});

it("holds submit until the recipient count is current", async () => {
  let resolvePreview: (response: Response) => void = () => {};
  const fetchMock = mockFetch((request) =>
    isTentativeRequest(request)
      ? new Promise<Response>((resolve) => {
          resolvePreview = resolve;
        })
      : Promise.resolve(Response.json([], { status: 201 })),
  );
  renderForm(formElement(7));
  const submit = screen.getByRole("button", { name: "Create Reminders" });

  expect(submit).toHaveProperty("disabled", true);
  await waitFor(() => expect(tentativeRequests(fetchMock)).toHaveLength(1));
  expect(submit).toHaveProperty("disabled", true);
  expect(screen.getByText("Counting recipients…")).toBeTruthy();
  resolvePreview(Response.json([plan], { status: 201 }));
  await waitFor(() => expect(submit).toHaveProperty("disabled", false));
});

it("starts at the earliest plan without reordering the previewed plans", async () => {
  const later = { scheduledFor: new Date(2030, 0, 2).toISOString() };
  const plans = Object.freeze([later, plan]);
  mockFetch(async () => {
    const response = Response.json(plans, { status: 201 });
    // Keeps the frozen array as state, so sorting it in place throws.
    jest.spyOn(response, "json").mockResolvedValue(plans);
    return response;
  });
  renderForm(formElement(7));

  expect(
    await screen.findByText(new Date(plan.scheduledFor).toLocaleString(), {
      exact: false,
    }),
  ).toBeTruthy();
});

it("holds submit after a failed preview until a retry succeeds", async () => {
  let failing = true;
  mockFetch(async (request) => {
    if (!isTentativeRequest(request)) {
      return Response.json([], { status: 201 });
    }
    if (failing) throw new TypeError("Failed to fetch");
    return Response.json([plan], { status: 201 });
  });
  renderForm(formElement(7));
  const submit = screen.getByRole("button", { name: "Create Reminders" });

  expect(await screen.findByText(countError)).toBeTruthy();
  expect(submit).toHaveProperty("disabled", true);

  failing = false;
  fireEvent.click(
    screen.getByRole("button", { name: "Retry recipient count" }),
  );
  await waitFor(() => expect(submit).toHaveProperty("disabled", false));
  expect(screen.queryByText(countError)).toBeNull();
});

it("shows why the server refused to count recipients", async () => {
  mockFetch(async (request) =>
    isTentativeRequest(request)
      ? Response.json({ message: "Unknown tag" }, { status: 400 })
      : Response.json([], { status: 201 }),
  );
  renderForm(formElement(7));

  expect(await screen.findByText("Unknown tag")).toBeTruthy();
});

it("replaces a failed preview's error while it recounts", async () => {
  const fetchMock = mockFetch((request) => {
    if (!isTentativeRequest(request)) {
      return Promise.resolve(Response.json([], { status: 201 }));
    }
    if (tentativeRequests(fetchMock).length === 1) {
      return Promise.reject(new TypeError("Failed to fetch"));
    }
    return new Promise<Response>(() => {});
  });
  const { rerender } = renderForm(formElement(7));
  expect(await screen.findByText(countError)).toBeTruthy();

  rerender(formElement(8));

  expect(screen.queryByText(countError)).toBeNull();
  expect(screen.getByText("Counting recipients…")).toBeTruthy();
});

it("clears a fixed validation error once the preview succeeds", async () => {
  mockFetch(async () => Response.json([plan], { status: 201 }));
  renderForm(
    <ActionReminderGroupForm
      suiteId={7}
      waitForRecipientCount
      memberEvents={[makeEvent({ id: 3 })]}
      anchorCandidates={[]}
      users={[]}
      loadingUsers={false}
      usersLoadFailed={false}
      userTags={[]}
      loadingUserTags={false}
      initialValues={{
        memberActionEventId: 3,
        reminderGroup: {
          name: "Window",
          cohortType: "all_uncompleted",
          timingMode: "within_relative_range",
          relative_range_start_seconds_from_deadline: 48 * 3600,
          relative_range_end_seconds_from_deadline: 24 * 3600,
          emailSubject: "Subject",
          emailMessage: "Message",
          textMessage: "Text",
          pushMessage: "Push",
          useSuiteTaskCount: false,
          excludeOptionalActions: false,
          excludePreviouslyNotified: false,
        },
        users: [],
      }}
      onSubmit={() => {}}
    />,
  );
  const windowError = "Window start must be before the window end.";
  const windowStart = screen.getByDisplayValue("48");
  fireEvent.change(windowStart, { target: { value: "1" } });
  expect(await screen.findByText(windowError)).toBeTruthy();

  fireEvent.change(windowStart, { target: { value: "48" } });

  await waitFor(() => expect(screen.queryByText(windowError)).toBeNull());
});

it("holds submit again when a change outdates the count", async () => {
  mockFetch(async () => Response.json([plan], { status: 201 }));
  const { rerender } = renderForm(formElement(7));
  const submit = screen.getByRole("button", { name: "Create Reminders" });
  await waitFor(() => expect(submit).toHaveProperty("disabled", false));

  rerender(formElement(8));

  expect(submit).toHaveProperty("disabled", true);
});

it("lets a form that needs no count submit while counting", async () => {
  const fetchMock = mockFetch((request) =>
    isTentativeRequest(request)
      ? new Promise<Response>(() => {})
      : Promise.resolve(Response.json([], { status: 201 })),
  );
  renderForm(formElement(7, false));

  await waitFor(() => expect(tentativeRequests(fetchMock)).toHaveLength(1));
  expect(
    screen.getByRole("button", { name: "Create Reminders" }),
  ).toHaveProperty("disabled", false);
});

it("previews the text message for the chosen task count", async () => {
  const fetchMock = mockFetch(async (request) =>
    request.url.endsWith("/actions/previewTextMessage/3")
      ? Response.json({ text: "Rendered text" })
      : Response.json([], { status: 201 }),
  );
  renderForm(formElement(7));

  fireEvent.click(
    screen.getByRole("button", { name: "Preview Text (2 tasks)" }),
  );

  expect(await screen.findByText("Rendered text")).toBeTruthy();
  const [previewRequest] = fetchMock.mock.calls
    .map(([request]) => request)
    .filter((request) => request.url.includes("/previewTextMessage/"));
  expect(await previewRequest.clone().json()).toMatchObject({ taskCount: 2 });
});

it("shows why an email preview failed", async () => {
  mockFetch(async (request) =>
    request.url.endsWith("/actions/previewEmailHtml/3")
      ? Response.json({ message: "Unknown keyword" }, { status: 400 })
      : Response.json([], { status: 201 }),
  );
  renderForm(formElement(7));

  fireEvent.click(
    screen.getByRole("button", { name: "Preview Email (1 task)" }),
  );

  expect(await screen.findByText("Unknown keyword")).toBeTruthy();
});

it("previews the push message", async () => {
  mockFetch(async (request) => {
    if (!request.url.endsWith("/actions/previewTextMessage/3")) {
      return Response.json([], { status: 201 });
    }
    const { textMessage } = await request.json();
    return Response.json({ text: `Rendered: ${textMessage}` });
  });
  renderForm(formElement(7));

  fireEvent.click(
    screen.getByRole("button", { name: "Preview Push (1 task)" }),
  );

  expect(
    await screen.findByText(`Rendered: ${defaultPushMessage}`),
  ).toBeTruthy();
});

it("keeps a save error visible over a failed preview", async () => {
  mockFetch(async (request) =>
    request.url.endsWith("/actions/previewEmailHtml/3")
      ? Response.json({ message: "Unknown keyword" }, { status: 400 })
      : Response.json([], { status: 201 }),
  );
  renderForm(
    <ActionReminderGroupForm
      {...formElement(7).props}
      serverError="Reminder name taken"
    />,
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Preview Email (1 task)" }),
  );

  expect(await screen.findByText("Unknown keyword")).toBeTruthy();
  expect(screen.getByText("Reminder name taken")).toBeTruthy();
});

it("switches the previewed task count and closes the preview", async () => {
  mockFetch(async (request) => {
    if (!request.url.endsWith("/actions/previewTextMessage/3")) {
      return Response.json([], { status: 201 });
    }
    const { taskCount } = await request.json();
    return Response.json({ text: `Rendered for ${taskCount}` });
  });
  renderForm(formElement(7));
  const previewTwo = screen.getByRole("button", {
    name: "Preview Text (2 tasks)",
  });

  fireEvent.click(
    screen.getByRole("button", { name: "Preview Text (1 task)" }),
  );
  expect(await screen.findByText("Rendered for 1")).toBeTruthy();
  fireEvent.click(previewTwo);
  expect(await screen.findByText("Rendered for 2")).toBeTruthy();
  fireEvent.click(previewTwo);

  expect(screen.queryByText("Rendered for 2")).toBeNull();
  expect(screen.getByDisplayValue(defaultTextMessage)).toBeTruthy();
});

it("reloads the push message and suite task count from new initial values", async () => {
  mockFetch();
  const { rerender } = renderForm(formElement(7));

  rerender(
    <ActionReminderGroupForm
      {...formElement(7).props}
      initialValues={{
        ...initialValues,
        reminderGroup: {
          name: "Preset",
          cohortType: "all_uncompleted",
          timingMode: "event_launch",
          emailSubject: "Subject",
          emailMessage: "Message",
          textMessage: "Text",
          pushMessage: "Preset push",
          useSuiteTaskCount: false,
          excludeOptionalActions: false,
          excludePreviouslyNotified: false,
        },
      }}
    />,
  );

  expect(screen.getByDisplayValue("Preset push")).toBeTruthy();
  expect(
    screen.getByRole("checkbox", { name: "Use suite task count" }),
  ).toHaveProperty("checked", false);
});

it("shows why it refuses to submit", async () => {
  mockFetch();
  const onSubmit = jest.fn();
  renderForm(
    <ActionReminderGroupForm
      {...formElement(7, false).props}
      onSubmit={onSubmit}
    />,
  );

  fireEvent.change(screen.getByDisplayValue("All uncompleted"), {
    target: { value: "custom" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create Reminders" }));

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Select at least one user.",
  );
  expect(onSubmit).not.toHaveBeenCalled();
});
