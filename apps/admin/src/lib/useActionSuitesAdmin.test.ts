import type { ActionSuiteDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useActionSuitesAdmin } from "./useActionSuitesAdmin";

const suite = (id: number, name: string): ActionSuiteDto => ({
  id,
  name,
  actions: [],
  events: [],
  reminderGroups: [],
  generalUpdates: [],
});

let suites: ActionSuiteDto[];
let respond: () => Response;
let created: unknown;

serveApi(
  routes({
    "GET /actions/suites": () => respond(),
    "POST /actions/createSuite": async ({ request }) => {
      created = await request.json();
      suites = [...suites, suite(4, "Autumn")];
      return Response.json(suite(4, "Autumn"));
    },
  }),
);

beforeEach(() => {
  suites = [suite(3, "Spring campaign")];
  respond = () => Response.json(suites);
  created = null;
});

describe("useActionSuitesAdmin", () => {
  it("reads the suites", async () => {
    const view = renderHook(() => useActionSuitesAdmin(), queryWrapper());

    await waitFor(() =>
      expect(view.result.current.suites.data).toEqual(suites),
    );
  });

  it("surfaces a refused load as an error carrying its status", async () => {
    respond = () => Response.json({ message: "Forbidden" }, { status: 403 });

    const view = renderHook(() => useActionSuitesAdmin(), queryWrapper());

    await waitFor(() =>
      expect(view.result.current.suites.isLoadingError).toBe(true),
    );
    expect(view.result.current.suites.error).toMatchObject({ statusCode: 403 });
  });

  it("creates a suite and reloads the list with it", async () => {
    const view = renderHook(() => useActionSuitesAdmin(), queryWrapper());
    await waitFor(() =>
      expect(view.result.current.suites.data).toHaveLength(1),
    );

    let result: ActionSuiteDto | undefined;
    await act(async () => {
      result = await view.result.current.createSuite.mutateAsync("Autumn");
    });

    expect(created).toEqual({ name: "Autumn" });
    expect(result).toMatchObject({ id: 4, name: "Autumn" });
    await waitFor(() =>
      expect(view.result.current.suites.data?.map((s) => s.name)).toEqual([
        "Spring campaign",
        "Autumn",
      ]),
    );
  });
});
