import { makeCommunity } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { UPDATE_GROUP_SESSION_EXPIRED } from "@alliance/shared/lib/useMyCommunities";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useCommunityEditor } from "./useCommunityEditor";

const community = makeCommunity();
let write: () => Response;

serveApi(
  routes({
    "GET /community/list/my": () => Response.json([community]),
    "GET /community/list/public": () => Response.json([]),
    [`PATCH /community/${community.id}`]: () => write(),
    [`DELETE /community/${community.id}`]: () => write(),
  }),
);

const renderEditor = () => {
  const onDeleted = jest.fn();
  const { wrapper } = queryWrapper();
  const hook = renderHook(
    () => useCommunityEditor({ community, memberCount: 1, onDeleted }),
    { wrapper },
  );
  return { hook, onDeleted };
};

it.each([
  { status: 400, shown: "Name taken" },
  { status: 500, shown: "Failed to update group" },
  { status: 401, shown: UPDATE_GROUP_SESSION_EXPIRED },
])("a save refused with $status shows $shown", async ({ status, shown }) => {
  write = () => Response.json({ message: "Name taken" }, { status });
  const { hook } = renderEditor();
  act(() => hook.result.current.setIsEditing(true));

  await act(() => hook.result.current.handleSave());

  expect(hook.result.current.error).toBe(shown);
  expect(hook.result.current.isEditing).toBe(true);
});

it("a saved group closes the editor", async () => {
  write = () => Response.json({ ...community, name: "Renamed" });
  const { hook } = renderEditor();
  act(() => hook.result.current.setIsEditing(true));

  await act(() => hook.result.current.handleSave());

  await waitFor(() => expect(hook.result.current.isEditing).toBe(false));
  expect(hook.result.current.error).toBeNull();
});

it("a refused delete shows its message and stays on the group", async () => {
  write = () => Response.json({ message: "Not your group" }, { status: 403 });
  const { hook, onDeleted } = renderEditor();

  await act(() => hook.result.current.handleDelete());

  expect(hook.result.current.error).toBe("Not your group");
  expect(onDeleted).not.toHaveBeenCalled();
});

it("a deleted group leaves the page", async () => {
  write = () => new Response(null, { status: 200 });
  const { hook, onDeleted } = renderEditor();

  await act(() => hook.result.current.handleDelete());

  expect(onDeleted).toHaveBeenCalled();
  expect(hook.result.current.error).toBeNull();
});
