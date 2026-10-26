import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { QueryObserver } from "@tanstack/react-query";
import { afterEach, expect, it } from "bun:test";
import { queryClient } from "./queryClient";

afterEach(() => queryClient.clear());

it("lets a notifications list mounting later in the load reuse the first fetch", async () => {
  let fetches = 0;
  const observe = () =>
    new QueryObserver(queryClient, {
      queryKey: queryKeys.notificationsList(20),
      queryFn: () => ++fetches,
    });

  const first = observe();
  const unsubscribeFirst = first.subscribe(() => {});
  await first.refetch();
  const unsubscribeSecond = observe().subscribe(() => {});
  await new Promise((resolve) => setTimeout(resolve, 20));

  expect(fetches).toBe(1);
  unsubscribeFirst();
  unsubscribeSecond();
});
