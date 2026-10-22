import type { ActionSuiteDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { makeEvent } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  act,
  fireEvent,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it } from "bun:test";
import type { ReactNode } from "react";
import { useActionSuiteAdmin } from "./useActionSuiteAdmin";

const suite = (titles: string[]): ActionSuiteDto => ({
  id: 3,
  name: "Suite",
  actions: [],
  events: titles.map((title, i) => makeEvent({ id: i + 1, title })),
  reminderGroups: [],
  generalUpdates: [],
});

let loadStatus = 200;
let writeStatus = 200;
let acknowledged: (string | null)[] = [];

const write = (titles: string[]) => () =>
  writeStatus === 200
    ? Response.json(suite(titles))
    : Response.json(
        { message: "Reminders depend on it" },
        { status: writeStatus },
      );

serveApi(
  routes({
    "GET /actions/suite/:id": () =>
      loadStatus === 200
        ? Response.json(suite(["Launch"]))
        : Response.json({}, { status: loadStatus }),
    "PATCH /actions/suite/:suiteId/batchUpdateSuiteEvents/:eventId": ({
      request,
    }) => {
      const ack = new URL(request.url).searchParams.get(
        "acknowledgeDeadlineShortening",
      );
      acknowledged.push(ack);
      if (ack === null && writeStatus === 409) {
        return Response.json(
          { message: "Moves the deadline earlier" },
          { status: 409 },
        );
      }
      return Response.json(suite(["Relaunch"]));
    },
    "POST /actions/suite/:suiteId/events": write(["Launch", "Deadline"]),
    "DELETE /actions/suite/:suiteId/events/:eventId": write([]),
  }),
);

beforeEach(() => {
  loadStatus = 200;
  writeStatus = 200;
  acknowledged = [];
});

const renderSuite = (query = queryWrapper()) =>
  renderHook(() => useActionSuiteAdmin(3), {
    wrapper: ({ children }: { children: ReactNode }) =>
      query.wrapper({ children: <ToastProvider>{children}</ToastProvider> }),
  });

const cachedTitles = (query: ReturnType<typeof queryWrapper>) =>
  query.client
    .getQueryData<ActionSuiteDto>(queryKeys.actionSuiteAdmin(3))
    ?.events.map((e) => e.title);

const loaded = async (query = queryWrapper()) => {
  const view = renderSuite(query);
  await waitFor(() => expect(view.result.current.suite.data).toBeDefined());
  return view;
};

describe("useActionSuiteAdmin", () => {
  it("loads the suite", async () => {
    const query = queryWrapper();
    await loaded(query);
    expect(cachedTitles(query)).toEqual(["Launch"]);
  });

  it("fails the load when the server refuses it", async () => {
    loadStatus = 500;
    const view = renderSuite();
    await waitFor(() => expect(view.result.current.suite.isError).toBe(true));
  });

  it("saves an edited event's suite into the cache", async () => {
    const query = queryWrapper();
    const view = await loaded(query);

    await act(() =>
      view.result.current.updateEvent.mutateAsync({
        eventId: 1,
        body: { title: "Relaunch" },
      }),
    );

    await waitFor(() => expect(cachedTitles(query)).toEqual(["Relaunch"]));
  });

  it("resends an edit that moves the deadline earlier once staff confirm", async () => {
    writeStatus = 409;
    const query = queryWrapper();
    const view = await loaded(query);

    let saved: Promise<unknown> | undefined;
    act(() => {
      saved = view.result.current.updateEvent.mutateAsync({
        eventId: 1,
        body: { date: "2026-01-01T00:00:00.000Z" },
      });
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Move deadline earlier" }),
    );
    await act(() => saved);

    expect(acknowledged).toEqual([null, "true"]);
    await waitFor(() => expect(cachedTitles(query)).toEqual(["Relaunch"]));
  });

  it("leaves the cache alone when staff decline to move the deadline", async () => {
    writeStatus = 409;
    const query = queryWrapper();
    const view = await loaded(query);

    let saved: Promise<unknown> | undefined;
    act(() => {
      saved = view.result.current.updateEvent.mutateAsync({
        eventId: 1,
        body: { date: "2026-01-01T00:00:00.000Z" },
      });
    });
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(await act(() => saved)).toBeNull();
    expect(acknowledged).toEqual([null]);
    expect(cachedTitles(query)).toEqual(["Launch"]);
  });

  it("saves an added event's suite into the cache", async () => {
    const query = queryWrapper();
    const view = await loaded(query);

    await act(() =>
      view.result.current.addEvent.mutateAsync({
        title: "Deadline",
        description: "",
        newStatus: "office_action",
        date: "2026-01-01T00:00:00.000Z",
      }),
    );

    await waitFor(() =>
      expect(cachedTitles(query)).toEqual(["Launch", "Deadline"]),
    );
  });

  it("saves the suite left after a delete into the cache", async () => {
    const query = queryWrapper();
    const view = await loaded(query);

    await act(() => view.result.current.deleteEvent.mutateAsync(1));

    await waitFor(() => expect(cachedTitles(query)).toEqual([]));
  });

  it("leaves the cache alone when a delete is refused", async () => {
    writeStatus = 400;
    const query = queryWrapper();
    const view = await loaded(query);

    await act(() =>
      expect(
        view.result.current.deleteEvent.mutateAsync(1),
      ).rejects.toMatchObject({ statusCode: 400 }),
    );

    expect(cachedTitles(query)).toEqual(["Launch"]);
  });
});
