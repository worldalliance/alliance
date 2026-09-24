import { expect, test } from "bun:test";
import { createServer, type Server } from "node:http";
import { createProxy } from "./claude-proxy.cjs";

async function listen(server: Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("No TCP address");
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

test("proxy forwards only model requests and keeps upstream credentials out of responses", async () => {
  const requests: {
    authorization?: string;
    apiKey?: string;
    path?: string;
    body: string;
  }[] = [];
  const upstream = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    requests.push({
      authorization: req.headers.authorization,
      apiKey: req.headers["x-api-key"]?.toString(),
      path: req.url,
      body,
    });
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write("data: first\n\n");
    res.end("data: second\n\n");
  });
  const upstreamOrigin = await listen(upstream);
  const proxy = createProxy({
    credential: "synthetic-upstream-credential",
    upstreamOrigin,
  });
  const origin = await listen(proxy);
  try {
    for (const path of [
      "/v1/messages",
      "/v1/messages/count_tokens?beta=true",
    ]) {
      const response = await fetch(`${origin}${path}`, {
        method: "POST",
        headers: {
          authorization: "Bearer local-screenshot-run",
          "x-api-key": "synthetic-attacker-key",
        },
        body: '{"model":"synthetic-model"}',
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("data: first\n\ndata: second\n\n");
    }
    expect(requests).toEqual(
      ["/v1/messages", "/v1/messages/count_tokens?beta=true"].map((path) => ({
        authorization: "Bearer synthetic-upstream-credential",
        apiKey: undefined,
        path,
        body: '{"model":"synthetic-model"}',
      })),
    );

    for (const path of [
      "/v1/files",
      "/v1/messages/../../admin",
      "/v1/messages?redirect=https://example.com",
      "//example.com/v1/messages",
    ]) {
      const response = await fetch(`${origin}${path}`, {
        method: "POST",
        headers: { authorization: "Bearer local-screenshot-run" },
      });
      expect(response.status).toBe(403);
    }
    expect(
      (await fetch(`${origin}/v1/messages`, { method: "POST" })).status,
    ).toBe(401);
    expect(
      (
        await fetch(`${origin}/v1/messages`, {
          headers: { authorization: "Bearer local-screenshot-run" },
        })
      ).status,
    ).toBe(403);
    expect(requests).toHaveLength(2);
  } finally {
    proxy.closeAllConnections();
    proxy.close();
    upstream.closeAllConnections();
    upstream.close();
  }
});

test("proxy preserves upstream authentication failures", async () => {
  const upstream = createServer((_, res) => {
    res.writeHead(401, { "content-type": "application/json" });
    res.end('{"error":"expired"}');
  });
  const upstreamOrigin = await listen(upstream);
  const proxy = createProxy({
    credential: "synthetic-expired-credential",
    upstreamOrigin,
  });
  const origin = await listen(proxy);
  try {
    const response = await fetch(`${origin}/v1/messages`, {
      method: "POST",
      headers: { authorization: "Bearer local-screenshot-run" },
      body: "{}",
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "expired" });
  } finally {
    proxy.closeAllConnections();
    proxy.close();
    upstream.closeAllConnections();
    upstream.close();
  }
});
