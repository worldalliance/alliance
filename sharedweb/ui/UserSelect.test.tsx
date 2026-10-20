import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { makeProfile } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import UserSelect, { useSelectableUsers } from "./UserSelect";

const renderFailed = () =>
  render(
    <UserSelect
      users={[]}
      selectedUserIds={[]}
      onChange={() => {}}
      loadFailed
    />,
  );

it("says the users failed to load before anything is typed", () => {
  renderFailed();

  expect(screen.getByText("Failed to load users.")).toBeTruthy();
});

it("says the users failed to load instead of that none match", () => {
  renderFailed();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Ana" } });

  expect(screen.getByText("Failed to load users.")).toBeTruthy();
  expect(screen.queryByText("No users match that search.")).toBeNull();
});

let membersStatus = 200;

serveApi(
  routes({
    "GET /user/members": () =>
      membersStatus === 200
        ? Response.json([{ ...makeProfile(2), displayName: "Ana" }])
        : Response.json({}, { status: membersStatus }),
  }),
);

beforeEach(() => {
  membersStatus = 200;
});

it("offers every member under their display name", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useSelectableUsers(), { wrapper });

  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  expect(hook.result.current.users).toEqual([
    { id: 2, name: "Ana", profilePicture: null },
  ]);
  expect(hook.result.current.isLoadingError).toBe(false);
});

it("reports a failed member load rather than offering no one", async () => {
  membersStatus = 500;
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useSelectableUsers(), { wrapper });

  await waitFor(() => expect(hook.result.current.isLoadingError).toBe(true));
  expect(hook.result.current.users).toEqual([]);
});

it("keeps offering the loaded members when a refetch fails", async () => {
  const query = queryWrapper();
  const hook = renderHook(() => useSelectableUsers(), query);
  await waitFor(() => expect(hook.result.current.users).toHaveLength(1));

  membersStatus = 500;
  await act(() => query.client.refetchQueries());
  await waitFor(() =>
    expect(query.client.getQueryState(queryKeys.members())?.status).toBe(
      "error",
    ),
  );

  expect(hook.result.current.isLoadingError).toBe(false);
  expect(hook.result.current.users).toEqual([
    { id: 2, name: "Ana", profilePicture: null },
  ]);
});
