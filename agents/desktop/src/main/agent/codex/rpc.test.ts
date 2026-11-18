import { expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import { R } from "../../../../../../common/src/result";
import { type Notification, RpcConnection, type ServerRequest } from "./rpc";

function connect() {
  const input = new PassThrough();
  const output = new PassThrough();
  const written: unknown[] = [];
  output.setEncoding("utf8").on("data", (chunk: string) =>
    written.push(
      ...chunk
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line)),
    ),
  );
  const notifications: Notification[] = [];
  const requests: ServerRequest[] = [];
  const unreadable: string[] = [];
  const rpc = new RpcConnection({
    input,
    output,
    onNotification: (n) => notifications.push(n),
    onServerRequest: (r) => requests.push(r),
    onUnreadable: (line, error) => unreadable.push(`${line}: ${error.message}`),
  });
  const send = (message: unknown) =>
    input.write(
      `${typeof message === "string" ? message : JSON.stringify(message)}\n`,
    );
  return { rpc, send, written, notifications, requests, unreadable };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("a request resolves with its response's result, matched by id", async () => {
  const { rpc, send, written } = connect();
  const first = rpc.request("a", { x: 1 });
  const second = rpc.request("b", null);
  await tick();
  expect(written).toEqual([
    { id: 1, method: "a", params: { x: 1 } },
    { id: 2, method: "b", params: null },
  ]);
  send({ id: 2, result: "two" });
  send({ id: 1, result: { one: true } });
  expect(await first).toEqual(R.success({ one: true }));
  expect(await second).toEqual(R.success("two"));
});

test("an error response fails the request with its message", async () => {
  const { rpc, send } = connect();
  const pending = rpc.request("a", {});
  send({ id: 1, error: { code: -32600, message: "no rollout found" } });
  const result = await pending;
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.message).toBe("no rollout found");
});

test("a response without a result or a readable error fails its request", async () => {
  const { rpc, send } = connect();
  const unreadableError = rpc.request("a", {});
  const empty = rpc.request("b", {});
  send({ id: 1, error: { code: -1 } });
  send({ id: 2 });
  for (const pending of [unreadableError, empty]) {
    const result = await pending;
    expect(result.ok ? "" : result.error.message).toStartWith(
      "app-server answered with neither a result nor an error",
    );
  }
});

test("notifications and requests from app-server reach their handlers", async () => {
  const { send, notifications, requests } = connect();
  send({ method: "turn/started", params: { threadId: "t" } });
  send({ id: "ask", method: "item/tool/requestUserInput", params: {} });
  await tick();
  expect(notifications).toEqual([
    { method: "turn/started", params: { threadId: "t" } },
  ]);
  expect(requests).toEqual([
    { id: "ask", method: "item/tool/requestUserInput", params: {} },
  ]);
});

test("a line that isn't JSON-RPC, or answers no request, is unreadable", async () => {
  const { send, unreadable } = connect();
  send("nonsense");
  send({ id: 7, result: {} });
  send({});
  await tick();
  expect(unreadable).toHaveLength(3);
  expect(unreadable[1]).toContain(
    "a response to request 7, which isn't pending",
  );
  expect(unreadable[2]).toContain(
    "neither a request, a notification nor a response",
  );
});

test("closing fails pending and later requests", async () => {
  const { rpc } = connect();
  const pending = rpc.request("a", {});
  rpc.close(new Error("Codex exited (code 1)."));
  expect(await pending).toEqual(R.failure(new Error("Codex exited (code 1).")));
  expect(await rpc.request("b", {})).toEqual(
    R.failure(new Error("Codex exited (code 1).")),
  );
});

test("respondMethodNotFound answers a server request by its id", async () => {
  const { rpc, written } = connect();
  rpc.respondMethodNotFound("ask", "not supported");
  await tick();
  expect(written).toEqual([
    { id: "ask", error: { code: -32601, message: "not supported" } },
  ]);
});

test("notify sends a notification without an id, leaving out absent params", async () => {
  const { rpc, written } = connect();
  rpc.notify("initialized");
  rpc.notify("note", { a: 1 });
  await tick();
  expect(written).toEqual([
    { method: "initialized" },
    { method: "note", params: { a: 1 } },
  ]);
});
