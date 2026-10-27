import type { CreateReminderGroupDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { useReminderTentativePlansAdmin } from "./useReminderTentativePlansAdmin";

const group: CreateReminderGroupDto = {
  name: "Nudge",
  timingMode: "event_launch",
  cohortType: "all_uncompleted",
  emailMessage: "Message",
  emailSubject: "Subject",
  textMessage: "Text",
  pushMessage: "Push",
  useSuiteTaskCount: false,
  excludeOptionalActions: false,
  excludePreviouslyNotified: false,
};

const requests: unknown[] = [];
let respond: (body: CreateReminderGroupDto) => Promise<Response> | Response;

serveApi(
  routes({
    "POST /actions/events/:eventId/checkTentativePlans": async ({
      request,
      params,
    }) => {
      const body: CreateReminderGroupDto = await request.json();
      requests.push({ ...params, name: body.name });
      return respond(body);
    },
  }),
);

const plansFor = (body: CreateReminderGroupDto) => [
  { scheduledFor: new Date(2030, 0, 1).toISOString(), name: body.name },
];

beforeEach(() => {
  respond = (body) => Response.json(plansFor(body), { status: 201 });
});

afterEach(() => {
  requests.length = 0;
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
});

const render = (initial: CreateReminderGroupDto | null) =>
  renderHook(
    (props: { group: CreateReminderGroupDto | null }) =>
      useReminderTentativePlansAdmin(3, props.group),
    { ...queryWrapper(), initialProps: { group: initial } },
  );

describe("useReminderTentativePlansAdmin", () => {
  it("counts only the group the edits settle on", async () => {
    const view = render(group);
    view.rerender({ group: { ...group, name: "Second" } });
    view.rerender({ group: { ...group, name: "Third" } });

    await waitFor(() =>
      expect(view.result.current.plans).toEqual(
        plansFor({ ...group, name: "Third" }),
      ),
    );
    expect(requests).toEqual([{ eventId: "3", name: "Third" }]);
  });

  it("does not load without a group", async () => {
    const view = render(null);

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(view.result.current.plans).toBeUndefined();
    expect(requests).toEqual([]);
  });

  it("withholds the count while it is counted again", async () => {
    const query = queryWrapper();
    const view = renderHook(
      () => useReminderTentativePlansAdmin(3, group),
      query,
    );
    await waitFor(() => expect(view.result.current.plans).toBeDefined());

    let release: () => void = () => {};
    respond = (body) =>
      new Promise((resolve) => {
        release = () => resolve(Response.json(plansFor(body), { status: 201 }));
      });
    void query.client.refetchQueries();
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(view.result.current.plans).toBeUndefined();

    release();
    await waitFor(() =>
      expect(view.result.current.plans).toEqual(plansFor(group)),
    );
  });

  it("drops a draft's plans once the form moves past it", async () => {
    const query = queryWrapper();
    const view = renderHook(
      (props: { group: CreateReminderGroupDto }) =>
        useReminderTentativePlansAdmin(3, props.group),
      { ...query, initialProps: { group } },
    );
    await waitFor(() => expect(view.result.current.plans).toBeDefined());
    const second = { ...group, name: "Second" };
    view.rerender({ group: second });
    await waitFor(() =>
      expect(view.result.current.plans).toEqual(plansFor(second)),
    );

    view.unmount();

    await waitFor(() =>
      expect(
        query.client.getQueryCache().findAll({
          queryKey: queryKeys.reminderTentativePlansAdmin(3, group).slice(0, 1),
        }),
      ).toEqual([]),
    );
  });

  it("keeps the count when the window regains focus", async () => {
    const view = render(group);
    await waitFor(() => expect(view.result.current.plans).toBeDefined());

    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(view.result.current.plans).toEqual(plansFor(group));
    expect(requests).toHaveLength(1);
  });

  it("surfaces a refused count as an error carrying its status", async () => {
    respond = () => Response.json({ message: "Unknown tag" }, { status: 400 });

    const view = render(group);

    await waitFor(() =>
      expect(view.result.current.error).toMatchObject({ statusCode: 400 }),
    );
    expect(view.result.current.plans).toBeUndefined();
  });

  it("counts a failed draft again when an edit settles back on it", async () => {
    respond = () => Response.json({ message: "Unknown tag" }, { status: 400 });
    const view = render(group);
    await waitFor(() => expect(view.result.current.error).toBeTruthy());

    respond = (body) => Response.json(plansFor(body), { status: 201 });
    view.rerender({ group: { ...group, name: "Second" } });
    view.rerender({ group: { ...group } });

    await waitFor(() =>
      expect(view.result.current.plans).toEqual(plansFor(group)),
    );
    expect(requests).toHaveLength(2);
  });

  it("counts while the browser reports offline", async () => {
    onlineManager.setOnline(false);

    const view = render(group);

    await waitFor(() =>
      expect(view.result.current.plans).toEqual(plansFor(group)),
    );
  });
});
