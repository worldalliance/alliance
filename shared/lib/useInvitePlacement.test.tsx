import { act, cleanup, renderHook } from "@testing-library/react";
import { useInvitePlacement } from "./useInvitePlacement";

afterEach(cleanup);

const ME = 1;
const led = { id: 10, leaders: [{ id: ME }] };
const alsoLed = { id: 11, leaders: [{ id: ME }] };
const joined = { id: 20, leaders: [{ id: 2 }] };

type Props = { communities: (typeof led)[]; userId: number | undefined };

const render = (initialProps: Props) =>
  renderHook(
    ({ communities, userId }: Props) => useInvitePlacement(communities, userId),
    { initialProps },
  );

it("places into a new group until the communities load", () => {
  const { result } = render({ communities: [], userId: ME });
  expect(result.current.placement).toEqual({ kind: "new" });
});

it("defaults to the first group the user leads", () => {
  const { result } = render({ communities: [joined, led], userId: ME });
  expect(result.current.placement).toEqual({ kind: "community", id: led.id });
  expect(result.current.selectedCommunity).toBe(led);
  expect(result.current.leaderCommunities).toEqual([led]);
});

it("defaults to a new group for a user who leads none", () => {
  const { result } = render({ communities: [joined], userId: ME });
  expect(result.current.placement).toEqual({ kind: "new" });
});

it("waits for the user before choosing a default", () => {
  const { result, rerender } = render({
    communities: [led],
    userId: undefined,
  });
  expect(result.current.placement).toEqual({ kind: "new" });

  rerender({ communities: [led], userId: ME });
  expect(result.current.placement).toEqual({ kind: "community", id: led.id });
});

it("keeps a manual choice across a refetch", () => {
  const { result, rerender } = render({ communities: [led], userId: ME });
  act(() => result.current.setPlacement({ kind: "assign" }));

  rerender({ communities: [led, alsoLed], userId: ME });
  expect(result.current.placement).toEqual({ kind: "assign" });
});

it("falls back when the chosen group is no longer led", () => {
  const { result, rerender } = render({
    communities: [led, alsoLed],
    userId: ME,
  });
  act(() => result.current.setPlacement({ kind: "community", id: alsoLed.id }));

  rerender({ communities: [led], userId: ME });
  expect(result.current.placement).toEqual({ kind: "community", id: led.id });

  rerender({ communities: [joined], userId: ME });
  expect(result.current.placement).toEqual({ kind: "new" });
  expect(result.current.selectedCommunity).toBeNull();
});
