const http = require("node:http");
const https = require("node:https");
const { writeFileSync } = require("node:fs");

function createProxy({
  credential,
  upstreamOrigin = "https://api.anthropic.com",
}) {
  const upstream = new URL(upstreamOrigin);
  const transport = upstream.protocol === "https:" ? https : http;
  return http.createServer((req, res) => {
    if (req.headers.authorization !== "Bearer local-screenshot-run") {
      res.writeHead(401).end();
      return;
    }
    if (
      req.method !== "POST" ||
      !/^\/v1\/messages(?:\/count_tokens)?(?:\?beta=true)?$/.test(req.url)
    ) {
      res.writeHead(403).end();
      return;
    }
    const headers = {
      authorization: `Bearer ${credential}`,
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
    };
    for (const name of ["anthropic-beta", "user-agent", "x-app"]) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }
    const request = transport.request(
      new URL(req.url, upstream),
      {
        method: "POST",
        headers,
        timeout: 300000,
      },
      (response) => {
        res.writeHead(response.statusCode, {
          "content-type":
            response.headers["content-type"] || "application/json",
        });
        response.pipe(res);
        response.on("error", () => res.destroy());
      },
    );
    let bytes = 0;
    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > 20 * 1024 * 1024) request.destroy();
    });
    req.on("aborted", () => request.destroy());
    res.on("close", () => request.destroy());
    request.on("timeout", () => request.destroy());
    request.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(request);
  });
}

async function main() {
  if (process.getuid() !== 0)
    throw new Error("The credential proxy must run as root");
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const credential = Buffer.concat(chunks).toString().trim();
  if (!credential) throw new Error("CLAUDE_CODE_OAUTH_TOKEN is missing");
  const server = createProxy({ credential });
  server.listen(0, "127.0.0.1", () => {
    writeFileSync(
      process.argv[2],
      JSON.stringify({ port: server.address().port }),
      { mode: 0o644 },
    );
  });
  setTimeout(
    () => {
      server.closeAllConnections();
      server.close();
    },
    70 * 60 * 1000,
  );
}

if (require.main === module)
  main().catch(() => {
    console.error("Could not start the Claude credential proxy");
    process.exitCode = 1;
  });

module.exports = { createProxy };
