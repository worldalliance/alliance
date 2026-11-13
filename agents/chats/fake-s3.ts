/** A local stand-in for the transcripts bucket that honours If-Match and
 * If-None-Match like S3. `beforeHead` runs before each HEAD is answered.
 * `beforePut` runs before each PUT is judged, and a response it returns
 * answers that PUT. */
export function fakeS3(
  params: {
    beforeHead?: (key: string) => void;
    beforePut?: (key: string) => Promise<Response | void> | Response | void;
  } = {},
) {
  const objects = new Map<string, { body: string; etag: string }>();
  let version = 0;
  const puts: string[] = [];
  const signers: { authorization: string | null; token: string | null }[] = [];
  const store = (key: string, body: string) => {
    const etag = `"${++version}"`;
    objects.set(key, { body, etag });
    return etag;
  };
  const failure = (status: number, code: string) =>
    new Response(
      `<Error><Code>${code}</Code><Message>${code}</Message></Error>`,
      {
        status,
        headers: { "content-type": "application/xml" },
      },
    );
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const key = decodeURIComponent(
        new URL(request.url).pathname.replace(/^\/alliance-agent-chats\//, ""),
      );
      if (request.method === "HEAD") params.beforeHead?.(key);
      const current = objects.get(key);
      switch (request.method) {
        case "HEAD":
          return current
            ? new Response(null, { headers: { etag: current.etag } })
            : new Response(null, { status: 404 });
        case "GET":
          return current
            ? new Response(current.body)
            : failure(404, "NoSuchKey");
        case "PUT": {
          const body = await request.text();
          signers.push({
            authorization: request.headers.get("authorization"),
            token: request.headers.get("x-amz-security-token"),
          });
          const answer = await params.beforePut?.(key);
          if (answer) return answer;
          const now = objects.get(key);
          const ifMatch = request.headers.get("if-match");
          if (request.headers.get("if-none-match") === "*" && now)
            return failure(412, "PreconditionFailed");
          if (ifMatch && !now) return failure(404, "NoSuchKey");
          if (ifMatch && ifMatch !== now?.etag)
            return failure(412, "PreconditionFailed");
          puts.push(key);
          return new Response(null, { headers: { etag: store(key, body) } });
        }
        default:
          return failure(405, "MethodNotAllowed");
      }
    },
  });
  return {
    endpoint: `http://127.0.0.1:${server.port}`,
    body: (key: string) => objects.get(key)?.body,
    store,
    remove: (key: string) => objects.delete(key),
    puts,
    signers,
    stop: () => server.stop(true),
  };
}
