import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { R } from "../../common/src/result";
import { fakeS3 } from "./fake-s3";
import { chatsClient, getObject, putLatest } from "./s3";

let dir: string;
let file: string;
let running: ReturnType<typeof fakeS3> | undefined;

const creds = { accessKeyId: "AKIAEXAMPLE", secretAccessKey: "secret" };
const client = (idleTimeoutMs?: number) =>
  R.unwrap(chatsClient(creds, { idleTimeoutMs }));

function start(params: Parameters<typeof fakeS3>[0] = {}) {
  running = fakeS3(params);
  process.env.ALLIANCE_AGENT_CHATS_S3_ENDPOINT = running.endpoint;
  return running;
}

const proxyVariables = ["HTTPS_PROXY", "https_proxy", "NO_PROXY", "no_proxy"];
const clearProxy = () => {
  for (const name of proxyVariables) delete process.env[name];
};

beforeEach(() => {
  clearProxy();
  dir = mkdtempSync(join(tmpdir(), "chats-s3-"));
  file = join(dir, "session.jsonl");
  writeFileSync(file, "first\n");
});

afterEach(() => {
  running?.stop();
  running = undefined;
  delete process.env.ALLIANCE_AGENT_CHATS_S3_ENDPOINT;
  delete process.env.AWS_SESSION_TOKEN;
  delete process.env.S3_SESSION_TOKEN;
  delete process.env.AWS_USE_FIPS_ENDPOINT;
  delete process.env.AWS_USE_DUALSTACK_ENDPOINT;
  delete process.env.AWS_MAX_ATTEMPTS;
  delete process.env.AWS_ENDPOINT_URL_S3;
  delete process.env.AWS_ENDPOINT_URL;
  clearProxy();
  rmSync(dir, { recursive: true });
});

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return address.port;
}

test("creates a missing object and replaces an existing one", async () => {
  const s3 = start();
  const key = "claude/a.jsonl";
  expect(await putLatest({ s3: client(), key, file })).toEqual({
    ok: true,
    value: undefined,
  });
  writeFileSync(file, "second\n");
  expect((await putLatest({ s3: client(), key, file })).ok).toBe(true);
  expect(s3.body(key)).toBe("second\n");
});

test("uploads whatever FIPS and dual-stack settings say", async () => {
  const s3 = start();
  process.env.AWS_USE_FIPS_ENDPOINT = "true";
  process.env.AWS_USE_DUALSTACK_ENDPOINT = "true";
  const key = "claude/a.jsonl";
  expect((await putLatest({ s3: client(), key, file })).ok).toBe(true);
  expect(s3.body(key)).toBe("first\n");
});

test("a write landing between its HEAD and PUT makes it start over with fresh bytes", async () => {
  let raced = false;
  const s3 = start({
    beforePut: (key) => {
      if (raced) return;
      raced = true;
      writeFileSync(file, "newest\n");
      s3.store(key, "newer, from another uploader\n");
    },
  });
  const key = "claude/a.jsonl";
  expect((await putLatest({ s3: client(), key, file })).ok).toBe(true);
  expect(s3.body(key)).toBe("newest\n");
});

test("reads the transcript after its HEAD, so a write the HEAD saw holds older bytes", async () => {
  let raced = false;
  const s3 = start({
    beforeHead: (key) => {
      if (raced) return;
      raced = true;
      writeFileSync(file, "newest\n");
      s3.store(key, "newer, from another uploader\n");
    },
  });
  const key = "claude/a.jsonl";
  expect((await putLatest({ s3: client(), key, file })).ok).toBe(true);
  expect(s3.body(key)).toBe("newest\n");
});

test("an object deleted between its HEAD and PUT is created afresh", async () => {
  let raced = false;
  const s3 = start({
    beforePut: (key) => {
      if (raced) return;
      raced = true;
      s3.remove(key);
    },
  });
  const key = "claude/a.jsonl";
  s3.store(key, "older\n");
  expect((await putLatest({ s3: client(), key, file })).ok).toBe(true);
  expect(s3.body(key)).toBe("first\n");
});

test("a conditional request conflict starts over", async () => {
  let conflicted = false;
  const s3 = start({
    beforePut: () => {
      if (conflicted) return;
      conflicted = true;
      return new Response(
        "<Error><Code>ConditionalRequestConflict</Code><Message>conflict</Message></Error>",
        { status: 409, headers: { "content-type": "application/xml" } },
      );
    },
  });
  const key = "claude/a.jsonl";
  expect((await putLatest({ s3: client(), key, file })).ok).toBe(true);
  expect(s3.body(key)).toBe("first\n");
});

test("gives up when the object changes before every PUT", async () => {
  const s3 = start({
    beforePut: (key) => void s3.store(key, "someone else's\n"),
  });
  const put = await putLatest({ s3: client(), key: "claude/a.jsonl", file });
  expect(put).toEqual({
    ok: false,
    error: "claude/a.jsonl changed during each of 5 tries",
  });
});

test("a transcript it cannot read fails without a PUT", async () => {
  const s3 = start();
  const put = await putLatest({
    s3: client(),
    key: "claude/a.jsonl",
    file: join(dir, "missing.jsonl"),
  });
  expect(put.ok).toBe(false);
  expect(s3.puts).toEqual([]);
});

test("a missing bucket fails with S3's error, not as a conflict", async () => {
  const missing = Bun.serve({
    port: 0,
    fetch: () =>
      new Response(
        "<Error><Code>NoSuchBucket</Code><Message>NoSuchBucket</Message></Error>",
        { status: 404, headers: { "content-type": "application/xml" } },
      ),
  });
  process.env.ALLIANCE_AGENT_CHATS_S3_ENDPOINT = `http://127.0.0.1:${missing.port}`;
  const put = await putLatest({ s3: client(), key: "claude/a.jsonl", file });
  missing.stop(true);
  expect(put.ok ? "" : put.error).toContain("NoSuchBucket");
});

test("a HEAD without an ETag fails without a PUT", async () => {
  const methods: string[] = [];
  const tagless = Bun.serve({
    port: 0,
    fetch: (request) => {
      methods.push(request.method);
      return new Response(null, { status: 200 });
    },
  });
  process.env.ALLIANCE_AGENT_CHATS_S3_ENDPOINT = `http://127.0.0.1:${tagless.port}`;
  const put = await putLatest({ s3: client(), key: "claude/a.jsonl", file });
  tagless.stop(true);
  expect(put.ok ? "" : put.error).toBe(
    "HEAD of claude/a.jsonl returned no ETag",
  );
  expect(methods).toEqual(["HEAD"]);
});

test("a connection that goes silent fails instead of hanging", async () => {
  const silent = createServer(() => {});
  process.env.ALLIANCE_AGENT_CHATS_S3_ENDPOINT = `http://127.0.0.1:${await listen(silent)}`;
  const put = await putLatest({
    s3: client(100),
    key: "claude/a.jsonl",
    file,
  });
  silent.close();
  expect(put.ok ? "" : put.error).toContain("timed out");
});

test("a response body that stalls after its headers fails instead of hanging", async () => {
  const server = createHttpServer((request, response) => {
    response.writeHead(request.method === "HEAD" ? 403 : 200, {
      "content-length": "10",
    });
    if (request.method === "HEAD") response.end();
    else response.write("x");
  });
  process.env.ALLIANCE_AGENT_CHATS_S3_ENDPOINT = `http://127.0.0.1:${await listen(server)}`;
  // The handler defers its idle timeout, the part that misses bodies, only
  // at 6 seconds or more.
  const s3 = client(6_000);
  const [got, put] = await Promise.all([
    getObject({ s3, key: "claude/a.jsonl" }),
    putLatest({ s3, key: "claude/a.jsonl", file }),
  ]);
  server.closeAllConnections();
  server.close();
  expect(got.ok ? "" : got.error).toContain("idle for 6000 ms");
  expect(put.ok ? "" : put.error).toContain("(403)");
}, 15_000);

function firstLines() {
  const lines: string[] = [];
  const server = createServer((socket) =>
    socket.once("data", (data) => {
      lines.push(data.toString("latin1").split("\r\n")[0] ?? "");
      socket.destroy();
    }),
  );
  return { server, lines };
}

test.each([
  ["with a scheme", "http://"],
  ["with an uppercase scheme", "HTTP://"],
  ["without a scheme", ""],
  ["starting with //", "//"],
])("HTTPS_PROXY %s tunnels requests through the proxy", async (_, prefix) => {
  const proxy = firstLines();
  process.env.HTTPS_PROXY = `${prefix}127.0.0.1:${await listen(proxy.server)}`;
  await getObject({ s3: client(), key: "claude/a.jsonl" });
  proxy.server.close();
  expect(proxy.lines[0]).toBe(
    "CONNECT alliance-agent-chats.s3.us-west-2.amazonaws.com:443 HTTP/1.1",
  );
});

test("an HTTPS_PROXY with another scheme fails naming it", () => {
  process.env.HTTPS_PROXY = "socks5://127.0.0.1:1080";
  const made = chatsClient(creds);
  expect(made.ok ? "" : made.error).toContain(
    "HTTPS_PROXY uses socks5:, which transcript uploads can't use",
  );
});

test("a NO_PROXY entry matching only part of a label still tunnels", async () => {
  const proxy = firstLines();
  process.env.HTTPS_PROXY = `http://127.0.0.1:${await listen(proxy.server)}`;
  process.env.NO_PROXY = "zonaws.com";
  await getObject({ s3: client(), key: "claude/a.jsonl" });
  proxy.server.close();
  expect(proxy.lines[0]).toStartWith("CONNECT ");
});

test.each([
  [
    "a leading-dot NO_PROXY entry",
    "HTTPS_PROXY",
    "localhost,.amazonaws.com",
    undefined,
  ],
  [
    "a bare NO_PROXY domain",
    "HTTPS_PROXY",
    "localhost, AMAZONAWS.COM",
    undefined,
  ],
  [
    "a NO_PROXY entry naming the host",
    "HTTPS_PROXY",
    "s3.us-west-2.amazonaws.com",
    undefined,
  ],
  ["NO_PROXY=*", "HTTPS_PROXY", "*", undefined],
  ["ALL_PROXY alone", "ALL_PROXY", undefined, undefined],
  ["an empty https_proxy beside HTTPS_PROXY", "HTTPS_PROXY", undefined, ""],
])("%s connects directly", async (_, variable, noProxy, lowerProxy) => {
  const proxy = firstLines();
  const direct = firstLines();
  process.env[variable] = `http://127.0.0.1:${await listen(proxy.server)}`;
  if (noProxy) process.env.NO_PROXY = noProxy;
  if (lowerProxy !== undefined) process.env.https_proxy = lowerProxy;
  const port = await listen(direct.server);
  const s3 = client();
  s3.middlewareStack.add(
    (next) => (args) => {
      const { request } = args;
      if (typeof request === "object" && request)
        Object.assign(request, { hostname: "127.0.0.1", port });
      return next(args);
    },
    { step: "finalizeRequest", priority: "low" },
  );
  await getObject({ s3, key: "claude/a.jsonl" });
  delete process.env[variable];
  proxy.server.close();
  direct.server.close();
  expect(proxy.lines).toEqual([]);
  // A TLS handshake record, which a CONNECT through a proxy would precede.
  expect(direct.lines[0]?.charCodeAt(0)).toBe(0x16);
});

test("a failed HEAD reports S3's error code, which only a GET carries", async () => {
  const denied = Bun.serve({
    port: 0,
    fetch: (request) =>
      request.method === "HEAD"
        ? new Response(null, { status: 403 })
        : new Response(
            "<Error><Code>InvalidAccessKeyId</Code><Message>no such key id</Message></Error>",
            { status: 403, headers: { "content-type": "application/xml" } },
          ),
  });
  process.env.ALLIANCE_AGENT_CHATS_S3_ENDPOINT = `http://127.0.0.1:${denied.port}`;
  const put = await putLatest({ s3: client(), key: "claude/a.jsonl", file });
  denied.stop(true);
  expect(put).toEqual({
    ok: false,
    error: "InvalidAccessKeyId (403): no such key id",
  });
});

test("a failed HEAD reads the GET's body, so its connection is reused", async () => {
  let connections = 0;
  const server = createHttpServer((request, response) => {
    response.writeHead(request.method === "HEAD" ? 403 : 206);
    response.end(request.method === "HEAD" ? undefined : "x");
  }).on("connection", () => connections++);
  process.env.ALLIANCE_AGENT_CHATS_S3_ENDPOINT = `http://127.0.0.1:${await listen(server)}`;
  const s3 = client();
  const first = await putLatest({ s3, key: "claude/a.jsonl", file });
  await putLatest({ s3, key: "claude/a.jsonl", file });
  server.close();
  expect(first.ok ? "" : first.error).toContain("(403)");
  expect(connections).toBe(3);
});

test("a failed HEAD keeps its own status when the GET for S3's code gets no answer", async () => {
  const stalled = Bun.serve({
    port: 0,
    fetch: (request) =>
      request.method === "HEAD"
        ? new Response(null, { status: 403 })
        : new Promise<Response>(() => {}),
  });
  process.env.ALLIANCE_AGENT_CHATS_S3_ENDPOINT = `http://127.0.0.1:${stalled.port}`;
  const put = await putLatest({
    s3: client(100),
    key: "claude/a.jsonl",
    file,
  });
  stalled.stop(true);
  expect(put.ok ? "" : put.error).toContain("(403)");
});

test("a failed HEAD keeps its own status when the GET fails for another reason", async () => {
  const empty = Bun.serve({
    port: 0,
    fetch: (request) =>
      request.method === "HEAD"
        ? new Response(null, { status: 403 })
        : new Response(
            "<Error><Code>InvalidRange</Code><Message>not satisfiable</Message></Error>",
            { status: 416, headers: { "content-type": "application/xml" } },
          ),
  });
  process.env.ALLIANCE_AGENT_CHATS_S3_ENDPOINT = `http://127.0.0.1:${empty.port}`;
  const put = await putLatest({ s3: client(), key: "claude/a.jsonl", file });
  empty.stop(true);
  expect(put.ok ? "" : put.error).toContain("(403)");
});

test("the standard endpoint variables can't redirect uploads", async () => {
  const s3 = start();
  delete process.env.ALLIANCE_AGENT_CHATS_S3_ENDPOINT;
  process.env.AWS_ENDPOINT_URL_S3 = s3.endpoint;
  process.env.AWS_ENDPOINT_URL = s3.endpoint;
  const s3Client = client();
  let host: string | undefined;
  s3Client.middlewareStack.add(
    () => async (args) => {
      host = z.object({ hostname: z.string() }).parse(args.request).hostname;
      throw new Error("not sent");
    },
    { step: "build" },
  );
  await putLatest({ s3: s3Client, key: "claude/a.jsonl", file });
  expect(host).toBe("alliance-agent-chats.s3.us-west-2.amazonaws.com");
});

test("the endpoint override accepts only a loopback URL", () => {
  process.env.ALLIANCE_AGENT_CHATS_S3_ENDPOINT = "http://example.com";
  const made = chatsClient(creds);
  expect(made.ok ? "" : made.error).toContain("must be a loopback URL");
});

test("ambient retry settings leave three attempts", async () => {
  start();
  process.env.AWS_MAX_ATTEMPTS = "10";
  const attempts = await client().config.maxAttempts();
  expect(attempts).toBe(3);
});

test("an ambient session token stays off uploads signed with static keys", async () => {
  const s3 = start();
  process.env.AWS_SESSION_TOKEN = "ambient";
  process.env.S3_SESSION_TOKEN = "ambient";
  expect(
    (await putLatest({ s3: client(), key: "claude/a.jsonl", file })).ok,
  ).toBe(true);
  expect(s3.signers).toEqual([
    {
      authorization: expect.stringContaining("Credential=AKIAEXAMPLE/"),
      token: null,
    },
  ]);
});

test("getObject returns a stored object's bytes and S3's error for a missing key", async () => {
  const s3 = start();
  s3.store("claude/a.jsonl", "hello\n");
  const got = await getObject({ s3: client(), key: "claude/a.jsonl" });
  expect(got.ok && new TextDecoder().decode(got.value)).toBe("hello\n");
  expect(
    await getObject({ s3: client(), key: "claude/missing.jsonl" }),
  ).toEqual({ ok: false, error: expect.stringContaining("NoSuchKey (404)") });
});
