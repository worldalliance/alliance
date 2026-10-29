import { R } from "@alliance/common/result";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "bun:test";
import { refetchFresh } from "./refetchFresh";

describe("refetchFresh", () => {
  it("fails a failed reload instead of returning the cached data", async () => {
    let calls = 0;
    const observer = new QueryObserver(new QueryClient(), {
      queryKey: ["suite"],
      queryFn: () => {
        calls += 1;
        if (calls > 1) throw new Error("network down");
        return { events: [] };
      },
      retry: false,
    });
    const unsubscribe = observer.subscribe(() => {});

    expect(await refetchFresh(observer.refetch)).toEqual(
      R.success({ events: [] }),
    );
    const failed = await refetchFresh(observer.refetch);
    expect(!failed.ok && failed.error.message).toBe("network down");
    unsubscribe();
  });

  it("fails a reload cancelled before it returns", async () => {
    const client = new QueryClient();
    let calls = 0;
    const observer = new QueryObserver(client, {
      queryKey: ["suite"],
      queryFn: async () => {
        calls += 1;
        if (calls > 1) await new Promise((resolve) => setTimeout(resolve, 50));
        return { events: calls };
      },
      retry: false,
    });
    const unsubscribe = observer.subscribe(() => {});
    await refetchFresh(observer.refetch);
    await new Promise((resolve) => setTimeout(resolve, 5));

    const reload = refetchFresh(observer.refetch);
    await client.cancelQueries({ queryKey: ["suite"] });
    const cancelled = await reload;
    expect(!cancelled.ok && cancelled.error.message).toContain("cancelled");
    unsubscribe();
  });
});
