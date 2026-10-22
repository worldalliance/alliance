import { beforeEach, onTestFinished } from "bun:test";

import { client } from "../../client/client.gen";
import { registerErrorStatus } from "../hey-api";

const originalConfig = client.getConfig();

// Every app registers this at startup, so a test without it reads an error no
// app ships.
registerErrorStatus(client);

// happy-dom refuses to construct a Request from a relative URL, and the client
// is configured without a baseUrl outside an app.
export const SERVED_API_URL = "http://api.test";

type ApiHandler = (request: Request) => Response | Promise<Response>;

export type RouteHandler = (input: {
  request: Request;
  params: Record<string, string>;
}) => Response | Promise<Response>;

/** Thrown for a request no route answered. */
export class UnroutedRequest extends Error {
  constructor(request: Request) {
    super(
      `unrouted request: ${request.method} ${new URL(request.url).pathname}`,
    );
    this.name = "UnroutedRequest";
  }
}

const matcher = (template: string) => {
  const wanted = template.split("/");
  return (pathname: string): Record<string, string> | null => {
    const segments = pathname.split("/");
    if (segments.length !== wanted.length) return null;
    const params: Record<string, string> = {};
    for (const [index, segment] of wanted.entries()) {
      const found = segments[index];
      if (segment.startsWith(":")) params[segment.slice(1)] = found;
      else if (segment !== found) return null;
    }
    return params;
  };
};

export type RouteTable = Record<string, RouteHandler>;

/** Answers each `"METHOD /path/:param"` from its handler, and hands anything
 * else to `fallback`, or throws UnroutedRequest when there is none. */
export const routes = (
  table: RouteTable,
  fallback?: ApiHandler,
): ApiHandler => {
  const routed = Object.entries(table).map(([route, handler]) => {
    const [method, template] = route.split(" ");
    if (!template) throw new Error(`route names no path: ${route}`);
    return { method, matches: matcher(template), handler };
  });
  return (request) => {
    const { pathname } = new URL(request.url);
    for (const { method, matches, handler } of routed) {
      const params = request.method === method ? matches(pathname) : null;
      if (params) return handler({ request, params });
    }
    if (fallback) return fallback(request);
    throw new UnroutedRequest(request);
  };
};

let unrouted: UnroutedRequest | null = null;

const serve = (
  handler: ApiHandler,
  { throwOnError }: { throwOnError: boolean },
): void => {
  client.setConfig({
    baseUrl: SERVED_API_URL,
    throwOnError,
    fetch: async (request) => {
      try {
        return await handler(request);
      } catch (thrown) {
        // Code under test reads a failed fetch as a server it could not reach,
        // so a path the handler does not match would pass as one.
        if (thrown instanceof UnroutedRequest) unrouted = thrown;
        throw thrown;
      }
    },
  });
};

/** What the client's fetch rejects with between served tests. */
export class UnservedRequest extends Error {
  constructor(request: Request) {
    super(
      `request outside a served test: ${request.method} ${new URL(request.url).pathname}`,
    );
    this.name = "UnservedRequest";
  }
}

// setConfig merges, so restore names every key serve overrides: one restore
// leaves out would survive the file and answer every later one. Its fetch
// rejects at once instead of reaching happy-dom's, which tries a real
// connection once a test has given the page an http URL.
const restore = (): void => {
  client.setConfig({
    baseUrl: originalConfig.baseUrl,
    throwOnError: originalConfig.throwOnError,
    fetch: async (request) => {
      throw new UnservedRequest(request);
    },
  });
};

/** What serveApi runs after each test: puts back the client's baseUrl and
 * throwOnError, leaves a fetch that rejects with UnservedRequest, then fails the
 * test on a request no route answered, whatever the code under test made of
 * the rejection. */
export const endServedTest = (): void => {
  restore();
  const missed = unrouted;
  unrouted = null;
  if (missed) throw missed;
};

export interface ServedApi {
  /** Answers the rest of this test from `table` instead, through a client
   * configured to throw on a refusal the way mobile configures it. A table
   * rather than a handler, so the test keeps the check that the request
   * reached the route it names. */
  throwingOnRefusal: (table: RouteTable) => void;

  /** Answers `table` for the rest of this test, and the file's routes for
   * every other request, through a client that returns a refusal the way web
   * configures it. Put a route only some tests need here, so every other test
   * still fails on a request no route answers. Replaces whatever an earlier
   * `throwingOnRefusal` or `alsoServing` installed. */
  alsoServing: (table: RouteTable) => void;
}

/** Answers every generated client call in this file from `handler`, and
 * stops answering after each test. Call at file scope. The handler stands in
 * for the client's fetch, so the 401 refresh createClientConfig wraps around it
 * never runs. */
export function serveApi(handler: ApiHandler): ServedApi {
  // onTestFinished runs after every afterEach, the preload's unmount among
  // them, so a request a tree sends as it unmounts is still served.
  beforeEach(() => {
    serve(handler, { throwOnError: false });
    onTestFinished(endServedTest);
  });
  return {
    throwingOnRefusal: (table) => serve(routes(table), { throwOnError: true }),
    alsoServing: (table) =>
      serve(routes(table, handler), { throwOnError: false }),
  };
}
