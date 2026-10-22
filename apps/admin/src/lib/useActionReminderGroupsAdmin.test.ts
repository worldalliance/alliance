import type { CreateReminderGroupDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { focusManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useActionReminderGroupsAdmin } from "./useActionReminderGroupsAdmin";

type StoredGroup = { id: number; name: string };

let stored: StoredGroup[] = [];
let nextId = 10;
let failLoad = false;
let failWrite: number | null = null;
let failPlans = false;
let plansGate: Promise<void> | null = null;
const requests: string[] = [];

const groupBody = {
  suiteId: 1,
  name: "Two days out",
  timingMode: "from_deadline",
  cohortType: "all_uncompleted",
  emailMessage: "",
  emailSubject: "",
  textMessage: "",
  pushMessage: "",
  useSuiteTaskCount: false,
  excludeOptionalActions: false,
  excludePreviouslyNotified: false,
} satisfies CreateReminderGroupDto;

serveApi(
  routes({
    "GET /actions/reminderGroupsForEvent/:id": ({ params }) => {
      requests.push(`groups ${params.id}`);
      if (failLoad) return Response.json({}, { status: 500 });
      return Response.json(stored);
    },
    "GET /actions/plansForGroup/:groupId": async ({ params }) => {
      requests.push(`plans ${params.groupId}`);
      await plansGate;
      if (failPlans) return Response.json({}, { status: 500 });
      if (!stored.some((group) => String(group.id) === params.groupId))
        return Response.json({}, { status: 500 });
      return Response.json([{ scheduledFor: params.groupId }]);
    },
    "GET /actions/sentNotifsForGroup/:groupId": ({ params }) =>
      Response.json([{ id: Number(params.groupId) }]),
    "POST /actions/events/:eventId/createremindergroup": async ({
      request,
    }) => {
      if (failWrite !== null)
        return Response.json(
          { message: "Group name taken" },
          { status: failWrite },
        );
      const { name }: { name: string } = await request.json();
      const created = { id: nextId++, name };
      stored = [...stored, created];
      return Response.json(created);
    },
    "PATCH /actions/remindergroups/:groupId": async ({ request, params }) => {
      if (failWrite !== null) return Response.json({}, { status: failWrite });
      const { name }: { name: string } = await request.json();
      stored = stored.map((group) =>
        String(group.id) === params.groupId ? { ...group, name } : group,
      );
      return Response.json(stored.find((g) => String(g.id) === params.groupId));
    },
    "DELETE /actions/reminders/:groupId": ({ params }) => {
      if (failWrite !== null) return Response.json({}, { status: failWrite });
      stored = stored.filter((group) => String(group.id) !== params.groupId);
      return new Response(null, { status: 200 });
    },
  }),
);

beforeEach(() => {
  stored = [{ id: 1, name: "Announcement" }];
  nextId = 10;
  failLoad = false;
  failWrite = null;
  failPlans = false;
  plansGate = null;
  requests.length = 0;
});

const render = (eventId: number | null = 5) =>
  renderHook(() => useActionReminderGroupsAdmin(eventId), queryWrapper());

const names = (view: ReturnType<typeof render>) =>
  view.result.current.groups?.map((group) => group.name);

describe("useActionReminderGroupsAdmin", () => {
  it("loads the event's groups and each group's plans and sent reminders", async () => {
    const view = render();

    await waitFor(() =>
      expect(view.result.current.detailsByGroup.get(1)).toEqual({
        groupId: 1,
        plans: [{ scheduledFor: "1" }],
        sent: [{ id: 1 }],
      }),
    );
    expect(names(view)).toEqual(["Announcement"]);
    expect(requests).toContain("groups 5");
  });

  it("requests nothing without an event", () => {
    const view = render(null);

    expect(view.result.current.groups).toBeUndefined();
    expect(requests).toEqual([]);
  });

  it("reports a failed load of the groups", async () => {
    failLoad = true;
    const view = render();

    await waitFor(() =>
      expect(view.result.current.groupsLoadFailed).toBe(true),
    );
  });

  it("reports a failed load of a group's details", async () => {
    failPlans = true;
    const view = render();

    await waitFor(() =>
      expect(view.result.current.detailsLoadFailed).toBe(true),
    );
  });

  it("creates groups in order and reloads the list with their details", async () => {
    const view = render();
    await waitFor(() => expect(names(view)).toEqual(["Announcement"]));

    let created: { id: number }[] = [];
    await act(async () => {
      created = await view.result.current.create.mutateAsync({
        eventId: 5,
        bodies: [
          { ...groupBody, name: "First" },
          { ...groupBody, name: "Second" },
        ],
      });
    });

    expect(created.map((group) => group.id)).toEqual([10, 11]);
    await waitFor(() =>
      expect(names(view)).toEqual(["Announcement", "First", "Second"]),
    );
    await waitFor(() =>
      expect(view.result.current.detailsByGroup.get(11)?.plans).toEqual([
        { scheduledFor: "11" },
      ]),
    );
  });

  it("rejects a refused create with the server's error", async () => {
    const view = render();
    await waitFor(() => expect(names(view)).toEqual(["Announcement"]));
    failWrite = 400;

    act(() =>
      view.result.current.create.mutate({ eventId: 5, bodies: [groupBody] }),
    );

    await waitFor(() =>
      expect(view.result.current.create.error).toMatchObject({
        message: "Group name taken",
      }),
    );
  });

  it("finishes a write without waiting for the plans to reload", async () => {
    const view = render();
    await waitFor(() =>
      expect(view.result.current.detailsByGroup.size).toBe(1),
    );
    let releasePlans = () => {};
    plansGate = new Promise((resolve) => {
      releasePlans = resolve;
    });

    await act(() =>
      view.result.current.update.mutateAsync({
        groupId: 1,
        body: { ...groupBody, name: "Renamed" },
      }),
    );

    expect(requests).toContain("plans 1");
    releasePlans();
  });

  it("does not reload plans when the window regains focus", async () => {
    const view = render();
    await waitFor(() =>
      expect(view.result.current.detailsByGroup.size).toBe(1),
    );
    requests.length = 0;

    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    await waitFor(() => expect(requests).toContain("groups 5"));
    expect(requests).not.toContain("plans 1");
    focusManager.setFocused(undefined);
  });

  it("reloads the list after an update", async () => {
    const view = render();
    await waitFor(() => expect(names(view)).toEqual(["Announcement"]));

    await act(() =>
      view.result.current.update.mutateAsync({
        groupId: 1,
        body: { ...groupBody, name: "Renamed" },
      }),
    );

    await waitFor(() => expect(names(view)).toEqual(["Renamed"]));
  });

  it("drops a deleted group without requesting its plans again", async () => {
    stored = [
      { id: 1, name: "Announcement" },
      { id: 2, name: "Reminder" },
    ];
    const view = render();
    await waitFor(() =>
      expect(view.result.current.detailsByGroup.size).toBe(2),
    );
    requests.length = 0;

    await act(() => view.result.current.remove.mutateAsync(2));

    await waitFor(() => expect(names(view)).toEqual(["Announcement"]));
    await waitFor(() => expect(requests).toContain("plans 1"));
    expect(requests).not.toContain("plans 2");
    expect(view.result.current.detailsLoadFailed).toBe(false);
  });

  it("keeps the list after a refused delete", async () => {
    const view = render();
    await waitFor(() => expect(names(view)).toEqual(["Announcement"]));
    failWrite = 403;

    act(() => view.result.current.remove.mutate(1));

    await waitFor(() => expect(view.result.current.remove.isError).toBe(true));
    expect(names(view)).toEqual(["Announcement"]);
    expect(view.result.current.detailsByGroup.has(1)).toBe(true);
  });
});
