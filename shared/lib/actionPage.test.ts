import { renderHook, waitFor } from "@testing-library/react";
import { useActionHandlers } from "./actionPage";
import { makeAction } from "./testFixtures";
import { routes, serveApi } from "./testing/serveApi";

let getResponse: () => Response;

serveApi(routes({ "GET /actions/slug/7": () => getResponse() }));

const renderHandlers = () =>
  renderHook(() => useActionHandlers(7, true, () => {}));

it("loads the action", async () => {
  const action = makeAction({ id: 7 });
  getResponse = () => Response.json(action);

  const hook = renderHandlers();

  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.action).toMatchObject({ id: 7 });
  expect(hook.result.current.notFound).toBe(false);
});

it("reports a 404 as not found", async () => {
  getResponse = () => Response.json({}, { status: 404 });

  const hook = renderHandlers();

  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.action).toBeNull();
  expect(hook.result.current.notFound).toBe(true);
});

it("does not report a server failure as not found", async () => {
  getResponse = () => Response.json({}, { status: 500 });

  const hook = renderHandlers();

  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.action).toBeNull();
  expect(hook.result.current.notFound).toBe(false);
});
