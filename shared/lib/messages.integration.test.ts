import { R, type Result } from "@alliance/common/result";
import { waitFor } from "@testing-library/dom";
import { afterEach, expect, it, mock, spyOn } from "bun:test";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { connectMessagingSocket } from "./messages";

const cleanups: (() => void | Promise<void>)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  mock.restore();
});

const messagingServer = async () => {
  const http = createServer();
  const server = new Server(http);
  const tokens: unknown[] = [];
  server.use((socket, next) => {
    tokens.push(socket.handshake.auth.token);
    next(
      socket.handshake.auth.token === "fresh"
        ? undefined
        : new Error("jwt expired"),
    );
  });
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  cleanups.push(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        http.closeAllConnections();
      }),
  );
  const address = http.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  let token = "expired";
  const url = `http://127.0.0.1:${address.port}`;
  return {
    connect: (onRefreshToken: () => Promise<Result<boolean, Error>>) => {
      const connection = connectMessagingSocket("/", {
        getWebSocketUrl: () => url,
        getAuthToken: () => token,
        onRefreshToken,
      });
      cleanups.push(connection.close);
      return connection;
    },
    tokens,
    saveToken: (value: string) => {
      token = value;
    },
  };
};

it("connects after middleware rejects an expired token and refresh saves a new one", async () => {
  const { connect, tokens, saveToken } = await messagingServer();
  const refresh = mock(async () => {
    saveToken("fresh");
    return R.success(true);
  });
  const { socket } = connect(refresh);

  await waitFor(() => expect(socket.connected).toBe(true), { timeout: 2500 });

  expect(refresh).toHaveBeenCalledTimes(1);
  expect(tokens).toEqual(["expired", "fresh"]);
});

it.each([
  ["failure", async () => R.failure(new Error("offline"))],
  [
    "rejection",
    async () => {
      throw new Error("offline");
    },
  ],
] as const)(
  "retries a refresh %s and connects without another external event",
  async (_label, fail) => {
    const { connect, tokens, saveToken } = await messagingServer();
    spyOn(console, "error").mockImplementation(() => {});
    const attempts: number[] = [];
    const refresh = mock(async () => {
      attempts.push(Date.now());
      if (attempts.length === 1) return fail();
      saveToken("fresh");
      return R.success(true);
    });
    const { socket } = connect(refresh);

    await waitFor(() => expect(socket.connected).toBe(true), { timeout: 2500 });

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(attempts[1] - attempts[0]).toBeGreaterThanOrEqual(900);
    expect(tokens).toEqual(["expired", "fresh"]);
  },
);

it("stops refreshing when the server rejects the newly saved token", async () => {
  const { connect, tokens, saveToken } = await messagingServer();
  const log = spyOn(console, "error").mockImplementation(() => {});
  const refresh = mock(async () => {
    saveToken("rejected");
    return R.success(true);
  });
  const { socket } = connect(refresh);

  await waitFor(() => expect(tokens).toEqual(["expired", "rejected"]));
  await Bun.sleep(1100);

  expect(refresh).toHaveBeenCalledTimes(1);
  expect(tokens).toHaveLength(2);
  expect(socket.connected).toBe(false);
  expect(socket.active).toBe(false);
  expect(log).toHaveBeenCalledWith(
    "Socket authentication failed after token refresh",
    new Error("jwt expired"),
  );
});

it("cancels a scheduled refresh retry when its owner cleans up", async () => {
  const { connect } = await messagingServer();
  const log = spyOn(console, "error").mockImplementation(() => {});
  const refresh = mock(async () => R.failure(new Error("offline")));
  const { socket, close } = connect(refresh);

  await waitFor(() => expect(log).toHaveBeenCalledTimes(1));
  close();
  await Bun.sleep(1100);

  expect(refresh).toHaveBeenCalledTimes(1);
  expect(socket.connected).toBe(false);
  expect(socket.active).toBe(false);
  expect(log).toHaveBeenCalledTimes(1);
});
