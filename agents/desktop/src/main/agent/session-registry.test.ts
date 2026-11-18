import { expect, test } from "bun:test";
import { R } from "../../../../../common/src/result";
import type { AgentSession } from "./session";
import { type SessionHooks, sessionRegistry } from "./session-registry";

const session = (id: string): AgentSession => ({
  id,
  turnRunning: false,
  firstMessageRead: Promise.resolve(false),
  send: () => R.success(undefined),
  interrupt: () => {},
  subscribe: () => () => {},
  close: () => Promise.resolve(),
});

test("a launch that rejects resolves to its failure and is forgotten", async () => {
  const sessions = sessionRegistry();
  const launched = await sessions.launch("a", () =>
    Promise.reject(new Error("launch threw")),
  );
  expect(launched).toEqual(R.failure(new Error("launch threw")));
  expect(sessions.live("a")).toBeUndefined();
});

test("a new session is live under the id its launch returns until it exits", async () => {
  const sessions = sessionRegistry();
  let hooks: SessionHooks | undefined;
  const started = await sessions.launchNew((given) => {
    hooks = given;
    return Promise.resolve(R.success(session("cli-given")));
  });
  expect(await sessions.live("cli-given")).toBe(started);
  hooks?.onExit();
  expect(sessions.live("cli-given")).toBeUndefined();
});

test("a new session's launch that rejects resolves to its failure", async () => {
  const sessions = sessionRegistry();
  expect(
    await sessions.launchNew(() => Promise.reject(new Error("launch threw"))),
  ).toEqual(R.failure(new Error("launch threw")));
});

test("a new session that exits before its launch resolves never joins the live set", async () => {
  const sessions = sessionRegistry();
  await sessions.launchNew((hooks) => {
    hooks.onExit();
    return Promise.resolve(R.success(session("exited")));
  });
  expect(sessions.live("exited")).toBeUndefined();
});

test("a new session that starts closing before its launch resolves isn't live, and a resume waits out its close", async () => {
  const sessions = sessionRegistry();
  const { promise: closed, resolve: finishClosing } =
    Promise.withResolvers<void>();
  await sessions.launchNew((hooks) => {
    hooks.onClosing(closed);
    return Promise.resolve(R.success(session("closing")));
  });
  expect(sessions.live("closing")).toBeUndefined();
  let relaunched = false;
  const resumed = sessions.launch("closing", () => {
    relaunched = true;
    return Promise.resolve(R.success(session("closing")));
  });
  await Bun.sleep(10);
  expect(relaunched).toBe(false);
  finishClosing();
  await resumed;
  expect(relaunched).toBe(true);
});

test("a new session's launch that throws resolves to its failure", async () => {
  const sessions = sessionRegistry();
  expect(
    await sessions.launchNew(() => {
      throw new Error("launch threw");
    }),
  ).toEqual(R.failure(new Error("launch threw")));
});
