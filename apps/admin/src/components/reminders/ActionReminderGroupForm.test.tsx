import { client } from "@alliance/shared/client/client.gen";
import { makeEvent } from "@alliance/shared/lib/testFixtures";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import ActionReminderGroupForm from "./ActionReminderGroupForm";
import { reminderPresets } from "./presets";

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

type FormProps = ComponentProps<typeof ActionReminderGroupForm>;

const formElement = ({
  suiteId = 7,
  waitForRecipientCount = true,
  reminderGroup = null,
  onSubmit = () => {},
}: {
  suiteId?: number;
  waitForRecipientCount?: boolean;
  reminderGroup?: FormProps["initialValues"]["reminderGroup"];
  onSubmit?: FormProps["onSubmit"];
} = {}) => (
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
    initialValues={{ ...initialValues, reminderGroup }}
    onSubmit={onSubmit}
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

const plan = { scheduledFor: new Date(2030, 0, 1).toISOString() };

it("previews the group with its suite", async () => {
  const fetchMock = mockFetch();
  render(formElement());

  await waitFor(() => expect(tentativeRequests(fetchMock)).toHaveLength(1));
  expect(await tentativeRequests(fetchMock)[0].clone().json()).toMatchObject({
    suiteId: 7,
  });
});

it("sends one preview request for a burst of changes", async () => {
  const fetchMock = mockFetch();
  const { rerender } = render(formElement());
  await new Promise((resolve) => setTimeout(resolve, 100));
  rerender(formElement({ suiteId: 8 }));
  await new Promise((resolve) => setTimeout(resolve, 100));
  rerender(formElement({ suiteId: 9 }));

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
  const { rerender } = render(formElement());
  await waitFor(() => expect(tentativeRequests(fetchMock)).toHaveLength(1));

  rerender(formElement({ suiteId: 8 }));
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
  render(formElement());
  const submit = screen.getByRole("button", { name: "Create Reminders" });

  expect(submit).toHaveProperty("disabled", true);
  await waitFor(() => expect(tentativeRequests(fetchMock)).toHaveLength(1));
  expect(submit).toHaveProperty("disabled", true);
  expect(screen.getByText("Counting recipients…")).toBeTruthy();
  resolvePreview(Response.json([plan], { status: 201 }));
  await waitFor(() => expect(submit).toHaveProperty("disabled", false));
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
  render(formElement());
  const submit = screen.getByRole("button", { name: "Create Reminders" });

  expect(await screen.findByText("Failed to fetch")).toBeTruthy();
  expect(submit).toHaveProperty("disabled", true);

  failing = false;
  fireEvent.click(
    screen.getByRole("button", { name: "Retry recipient count" }),
  );
  await waitFor(() => expect(submit).toHaveProperty("disabled", false));
  expect(screen.queryByText("Failed to fetch")).toBeNull();
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
  const { rerender } = render(formElement());
  expect(await screen.findByText("Failed to fetch")).toBeTruthy();

  rerender(formElement({ suiteId: 8 }));

  expect(screen.queryByText("Failed to fetch")).toBeNull();
  expect(screen.getByText("Counting recipients…")).toBeTruthy();
});

it("clears a fixed validation error once the preview succeeds", async () => {
  mockFetch(async () => Response.json([plan], { status: 201 }));
  render(
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
  const { rerender } = render(formElement());
  const submit = screen.getByRole("button", { name: "Create Reminders" });
  await waitFor(() => expect(submit).toHaveProperty("disabled", false));

  rerender(formElement({ suiteId: 8 }));

  expect(submit).toHaveProperty("disabled", true);
});

it("lets a form that needs no count submit while counting", async () => {
  const fetchMock = mockFetch((request) =>
    isTentativeRequest(request)
      ? new Promise<Response>(() => {})
      : Promise.resolve(Response.json([], { status: 201 })),
  );
  render(formElement({ waitForRecipientCount: false }));

  await waitFor(() => expect(tentativeRequests(fetchMock)).toHaveLength(1));
  expect(
    screen.getByRole("button", { name: "Create Reminders" }),
  ).toHaveProperty("disabled", false);
});

it("submits the streak recognition preset with its flag, which the admin can clear", async () => {
  mockFetch();
  const onSubmit = jest.fn();
  render(
    formElement({
      waitForRecipientCount: false,
      reminderGroup: reminderPresets["Streak recognition"],
      onSubmit,
    }),
  );
  const submit = screen.getByRole("button", { name: "Create Reminders" });

  fireEvent.click(submit);
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ streakRecognition: true });

  fireEvent.click(screen.getByLabelText("Streak recognition"));
  fireEvent.click(submit);
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
  expect(onSubmit.mock.calls[1][0]).toMatchObject({ streakRecognition: false });
});

it("drops streak recognition for a group-leads cohort, which the server rejects it for", async () => {
  mockFetch();
  const onSubmit = jest.fn();
  render(
    formElement({
      waitForRecipientCount: false,
      reminderGroup: {
        ...reminderPresets["Streak recognition"],
        cohortType: "group_leads_with_uncompleted",
      },
      onSubmit,
    }),
  );

  expect(screen.queryByLabelText("Streak recognition")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Create Reminders" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ streakRecognition: false });
});

it("drops streak recognition for a missed-suite reminder, which the server rejects it for", async () => {
  mockFetch();
  const onSubmit = jest.fn();
  render(
    formElement({
      waitForRecipientCount: false,
      reminderGroup: {
        ...reminderPresets["Missed Deadline"],
        streakRecognition: true,
      },
      onSubmit,
    }),
  );

  expect(screen.queryByLabelText("Streak recognition")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Create Reminders" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ streakRecognition: false });
});
