import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { z } from "zod";
import { R, type Result } from "../../../../../../common/src/result";
import { describeError } from "../../describe-error";

const requestId = z.union([z.string(), z.number()]);
const rpcError = z.looseObject({ code: z.number(), message: z.string() });
const incoming = z.looseObject({
  id: requestId.optional(),
  method: z.string().optional(),
  params: z.unknown().optional(),
});

function readResponse(
  response: Record<string, unknown>,
): Result<unknown, Error> {
  if ("result" in response && !("error" in response))
    return R.success(response.result);
  const error = rpcError.safeParse(response.error);
  return R.failure(
    new Error(
      error.success
        ? error.data.message
        : `app-server answered with neither a result nor an error Alliance agent can read: ${JSON.stringify(response)}`,
    ),
  );
}

export type Notification = { method: string; params: unknown };
export type ServerRequest = Notification & { id: string | number };

/** app-server's JSON-RPC over newline-delimited JSON, without the "jsonrpc" member it neither sends nor needs. */
export class RpcConnection {
  private nextId = 1;
  private readonly pending = new Map<
    number,
    (result: Result<unknown, Error>) => void
  >();
  private closed: Error | undefined;

  constructor(
    private readonly io: {
      input: Readable;
      output: Writable;
      onNotification: (notification: Notification) => void;
      onServerRequest: (request: ServerRequest) => void;
      onUnreadable: (line: string, error: Error) => void;
    },
  ) {
    createInterface({ input: io.input }).on("line", (line) =>
      this.handleLine(line),
    );
  }

  /** Resolves with the response's result, or fails with its error or with the error close() was given. */
  request(method: string, params: unknown): Promise<Result<unknown, Error>> {
    if (this.closed) return Promise.resolve(R.failure(this.closed));
    const id = this.nextId++;
    const { promise, resolve } =
      Promise.withResolvers<Result<unknown, Error>>();
    this.pending.set(id, resolve);
    this.io.output.write(`${JSON.stringify({ id, method, params })}\n`);
    return promise;
  }

  notify(method: string, params?: unknown): void {
    this.io.output.write(`${JSON.stringify({ method, params })}\n`);
  }

  respondMethodNotFound(id: string | number, message: string): void {
    this.io.output.write(
      `${JSON.stringify({ id, error: { code: -32601, message } })}\n`,
    );
  }

  /** Fails every pending and later request with this error. */
  close(error: Error): void {
    this.closed ??= error;
    for (const resolve of this.pending.values()) resolve(R.failure(error));
    this.pending.clear();
  }

  private handleLine(line: string): void {
    const parsed = R.fromThrowable(
      () => incoming.parse(JSON.parse(line)),
      (error) =>
        new Error(`not an app-server message: ${describeError(error)}`),
    );
    if (!parsed.ok) return this.io.onUnreadable(line, parsed.error);
    const { id, method, params } = parsed.value;
    if (method !== undefined)
      return id === undefined
        ? this.io.onNotification({ method, params })
        : this.io.onServerRequest({ id, method, params });
    const resolve = typeof id === "number" ? this.pending.get(id) : undefined;
    if (typeof id !== "number" || !resolve)
      return this.io.onUnreadable(
        line,
        new Error(
          id === undefined
            ? "neither a request, a notification nor a response"
            : `a response to request ${id}, which isn't pending`,
        ),
      );
    this.pending.delete(id);
    resolve(readResponse(parsed.value));
  }
}
