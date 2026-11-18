import { expect, test } from "bun:test";
import { R } from "../../../../../common/src/result";
import { sessionRegistry } from "./session-registry";

test("a launch that rejects resolves to its failure and is forgotten", async () => {
  const sessions = sessionRegistry();
  const launched = await sessions.launch("a", () =>
    Promise.reject(new Error("launch threw")),
  );
  expect(launched).toEqual(R.failure(new Error("launch threw")));
  expect(sessions.live("a")).toBeUndefined();
});
