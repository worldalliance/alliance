import { once } from "node:events";
import { createServer } from "node:http";

/** Serves a page whose script loads only once released, so a window loading it doesn't paint until then. */
export async function heldPage() {
  const held = Promise.withResolvers<void>();
  const requested = Promise.withResolvers<void>();
  const server = createServer((request, response) => {
    if (request.url !== "/held.js")
      return response.end(
        '<p>Alliance agent</p><script src="/held.js"></script>',
      );
    requested.resolve();
    void held.promise.then(() => response.end());
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (typeof address !== "object" || !address) throw new Error("no address");
  return {
    url: `http://127.0.0.1:${address.port}/`,
    requested: requested.promise,
    release: held.resolve,
    close: () => {
      held.resolve();
      server.closeAllConnections();
      server.close();
    },
  };
}
