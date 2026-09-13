import { client } from "../../client/client.gen";

const originalConfig = client.getConfig();

// happy-dom refuses to construct a Request from a relative URL, and the client
// is configured without a baseUrl outside an app.
const BASE_URL = "http://api.test";

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

/** Answers each `"METHOD /path/:param"` from its handler, and throws
 * UnroutedRequest for anything else. */
export const routes = (table: RouteTable): ApiHandler => {
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
    throw new UnroutedRequest(request);
  };
};

let unrouted: UnroutedRequest | null = null;

const serve = (
  handler: ApiHandler,
  { throwOnError }: { throwOnError: boolean },
): void => {
  client.setConfig({
    baseUrl: BASE_URL,
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

// setConfig merges, so restore names every key serve overrides: one restore
// leaves out would survive the file and answer every later one.
const restore = (): void => {
  client.setConfig({
    baseUrl: originalConfig.baseUrl,
    throwOnError: originalConfig.throwOnError,
    fetch: originalConfig.fetch,
  });
};

/** What serveApi runs after each test: puts the client back, then fails the
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
}

/** Answers every generated client call in this file from `handler`, and puts
 * the client back after each test. Call at file scope. The handler stands in
 * for the client's fetch, so the 401 refresh createClientConfig wraps around it
 * never runs. */
export function serveApi(handler: ApiHandler): ServedApi {
  beforeEach(() => serve(handler, { throwOnError: false }));
  afterEach(endServedTest);
  return {
    throwingOnRefusal: (table) => serve(routes(table), { throwOnError: true }),
  };
}
