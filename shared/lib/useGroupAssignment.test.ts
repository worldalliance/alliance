import { act, renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useGroupAssignment } from "./useGroupAssignment";

let status = 200;

const answer = async () =>
  status === 200
    ? Response.json({})
    : Response.json({ message: "down" }, { status });

serveApi(
  routes({
    "POST /user/groupAssignment/join": answer,
    "POST /user/groupAssignment/leave": answer,
  }),
);

beforeEach(() => {
  status = 200;
});

const renderAssignment = () => {
  const onChanged = jest.fn(() => Promise.resolve());
  const hook = renderHook(
    () => useGroupAssignment({ onChanged }),
    queryWrapper(),
  );
  return { hook, onChanged };
};

it.each(["join", "leave"] as const)(
  "reloads the user after a %s succeeds",
  async (action) => {
    const { hook, onChanged } = renderAssignment();

    act(() => hook.result.current[action].mutate());

    await waitFor(() =>
      expect(hook.result.current[action].isSuccess).toBe(true),
    );
    expect(onChanged).toHaveBeenCalledTimes(1);
  },
);

it.each(["join", "leave"] as const)(
  "leaves the user alone when a %s is refused",
  async (action) => {
    status = 500;
    const { hook, onChanged } = renderAssignment();

    act(() => hook.result.current[action].mutate());

    await waitFor(() => expect(hook.result.current[action].isError).toBe(true));
    expect(onChanged).not.toHaveBeenCalled();
  },
);
