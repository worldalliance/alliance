import { createRequestHandler } from "@react-router/express";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import client from "prom-client";

const viteDevServer = ["production", "staging"].includes(process.env.NODE_ENV)
  ? undefined
  : await import("vite").then((vite) =>
      vite.createServer({
        server: { middlewareMode: true },
      }),
    );

const reactRouterHandler = createRequestHandler({
  build: await import("./build/server/index.js"),
});

const app = express();

app.use(compression());

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable("x-powered-by");

const register = new client.Registry();

// collect default Node/process metrics
client.collectDefaultMetrics({ register });

// histogram for SSR HTTP latency (seconds)
const ssrHttpRequestDuration = new client.Histogram({
  name: "ssr_http_request_duration_seconds",
  help: "Duration of SSR HTTP requests in seconds",
  labelNames: ["method", "path", "status_code"],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
});

register.registerMetric(ssrHttpRequestDuration);

// handle asset requests
if (viteDevServer) {
  app.use(viteDevServer.middlewares);
} else {
  // Vite fingerprints its assets so we can cache forever.
  app.use(
    "/assets",
    express.static("build/client/assets", { immutable: true, maxAge: "1y" }),
  );
}

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use((req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1_000_000;
    const seconds = ms / 1000;

    const path = req.path || "unknown";
    ssrHttpRequestDuration
      .labels(req.method, path, String(res.statusCode))
      .observe(seconds);
  });

  next();
});

// Everything else (like favicon.ico) is cached for an hour. You may want to be
// more aggressive with this caching.
app.use(express.static("build/client", { maxAge: "1h" }));

app.use(morgan("tiny"));

// handle SSR requests
app.all("{*splat}", reactRouterHandler);

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(
    `Express server listening at http://localhost:${port} NODE_ENV: ${process.env.NODE_ENV}`,
  ),
);
