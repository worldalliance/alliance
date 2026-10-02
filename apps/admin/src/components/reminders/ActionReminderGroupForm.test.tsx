import { client } from "@alliance/shared/client/client.gen";
import { makeEvent } from "@alliance/shared/lib/testFixtures";
import { cleanup, render, waitFor } from "@testing-library/react";
import ActionReminderGroupForm from "./ActionReminderGroupForm";

const { baseUrl, fetch } = client.getConfig();

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  client.setConfig({ baseUrl, fetch });
});

it("previews the group with its suite", async () => {
  const fetchMock = jest.fn(async (_request: Request) =>
    Response.json([], { status: 201 }),
  );
  client.setConfig({ baseUrl: "http://localhost", fetch: fetchMock });
  render(
    <ActionReminderGroupForm
      suiteId={7}
      memberEvents={[makeEvent({ id: 3 })]}
      anchorCandidates={[]}
      users={[]}
      loadingUsers={false}
      userTags={[]}
      loadingUserTags={false}
      initialValues={{ memberActionEventId: 3, reminderGroup: null, users: [] }}
      onSubmit={() => {}}
    />,
  );

  const tentativeRequest = () =>
    fetchMock.mock.calls
      .map(([request]) => request)
      .find((request) => request.url.endsWith("/checkTentativePlans"));
  await waitFor(() => expect(tentativeRequest()).toBeDefined());
  expect(await tentativeRequest()?.clone().json()).toMatchObject({
    suiteId: 7,
  });
});
