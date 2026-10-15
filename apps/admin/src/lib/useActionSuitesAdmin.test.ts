import type { ActionSuiteDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useActionSuitesAdmin } from "./useActionSuitesAdmin";

afterEach(cleanup);

const suites: ActionSuiteDto[] = [
  {
    id: 3,
    name: "Spring campaign",
    actions: [],
    events: [],
    reminderGroups: [],
    generalUpdates: [],
  },
];

let respond: () => Response;

serveApi(routes({ "GET /actions/suites": () => respond() }));

beforeEach(() => {
  respond = () => Response.json(suites);
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
});
