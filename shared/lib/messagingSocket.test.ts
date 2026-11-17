import { R, type Result } from "@alliance/common/result";
import { afterEach, beforeEach, expect, it, jest, mock, spyOn } from "bun:test";
import { Manager, type Socket } from "socket.io-client";
import { connectMessagingSocket } from "./messagingSocket";

const cleanups: (() => void)[] = [];

beforeEach(() => {
  spyOn(console, "warn").mockImplementation(() => {});
  spyOn(Manager.prototype, "open").mockImplementation(function (this: Manager) {
    return this;
  });
});

afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  mock.restore();
  jest.useRealTimers();
});

const expired = new Error("jwt expired");

const connectError = async (socket: Socket, error = expired) => {
  for (const listener of socket.listeners("connect_error"))
    await listener(error);
};

const attached = (onRefreshToken?: () => Promise<Result<boolean, Error>>) => {
  const { socket, close } = connectMessagingSocket("/", {
    getWebSocketUrl: () => "http://messaging.test",
    getAuthToken: () => "expired",
    onRefreshToken,
  });
  const connect = spyOn(socket, "connect").mockReturnValue(socket);
  const disconnect = spyOn(socket, "disconnect").mockReturnValue(socket);
  cleanups.push(close);
  return { socket, connect, disconnect, close };
};

it("reads the latest stored token after a socket refresh and a later HTTP refresh", async () => {
  let storedToken = "expired";
  const config = {
    getWebSocketUrl: () => "http://messaging.test",
    getAuthToken: async () => storedToken,
    onRefreshToken: mock(async () => {
      storedToken = "socket-refreshed";
      return R.success(true);
    }),
  };
  const { socket, close } = connectMessagingSocket("/", config);
  spyOn(socket, "connect").mockReturnValue(socket);
  cleanups.push(close);

  const readAuth = () =>
    new Promise<object>((resolve) => {
      if (typeof socket.auth === "function") {
        socket.auth(resolve);
      } else {
        resolve(socket.auth);
      }
    });

  expect(await readAuth()).toEqual({ token: "expired" });

  await connectError(socket);

  expect(config.onRefreshToken).toHaveBeenCalledTimes(1);
  expect(socket.connect).toHaveBeenCalledTimes(1);
  expect(await readAuth()).toEqual({ token: "socket-refreshed" });

  storedToken = "http-refreshed";

  expect(await readAuth()).toEqual({ token: "http-refreshed" });
});

it("hangs up without reconnecting when the refresh returns no session", async () => {
  const refresh = mock(async () => R.success(false));
  const { socket, connect, disconnect } = attached(refresh);

  await connectError(socket);

  expect(refresh).toHaveBeenCalledTimes(1);
  expect(connect).not.toHaveBeenCalled();
  expect(disconnect).toHaveBeenCalledTimes(1);
});

it("stops and logs once a token it refreshed still cannot connect", async () => {
  const log = spyOn(console, "error").mockImplementation(() => {});
  const refresh = mock(async () => R.success(true));
  const { socket, connect, disconnect } = attached(refresh);

  await connectError(socket);
  await connectError(socket, new Error("Unauthorized"));

  expect(refresh).toHaveBeenCalledTimes(1);
  expect(connect).toHaveBeenCalledTimes(1);
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenCalledWith(
    "Socket authentication failed after token refresh",
    new Error("Unauthorized"),
  );
});

it("refreshes again once the socket has connected", async () => {
  const refresh = mock(async () => R.success(true));
  const { socket, connect } = attached(refresh);

  await connectError(socket);
  for (const listener of socket.listeners("connect")) listener();
  await connectError(socket);

  expect(refresh).toHaveBeenCalledTimes(2);
  expect(connect).toHaveBeenCalledTimes(2);
});

it("leaves an error that is not about the token alone", async () => {
  const refresh = mock(async () => R.success(true));
  const { socket, connect, disconnect } = attached(refresh);

  await connectError(socket, new Error("xhr poll error"));

  expect(refresh).not.toHaveBeenCalled();
  expect(connect).not.toHaveBeenCalled();
  expect(disconnect).not.toHaveBeenCalled();
});

it("doesn't reconnect after an auth error without a refresh callback", async () => {
  const { socket, connect } = attached();

  await connectError(socket, new Error("Unauthorized"));

  expect(connect).not.toHaveBeenCalled();
});

it("retries a handshake the server couldn't check, backing off until it connects", async () => {
  jest.useFakeTimers();
  spyOn(Math, "random").mockReturnValue(0.5);
  const warn = spyOn(console, "warn");
  const refresh = mock(async () => R.success(true));
  const { socket, connect } = attached(refresh);
  const unavailable = new Error("Unavailable");

  await connectError(socket, unavailable);
  jest.advanceTimersByTime(999);
  expect(connect).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(connect).toHaveBeenCalledTimes(1);

  await connectError(socket, unavailable);
  jest.advanceTimersByTime(1999);
  expect(connect).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1);
  expect(connect).toHaveBeenCalledTimes(2);

  for (const listener of socket.listeners("connect")) listener();
  await connectError(socket, unavailable);
  jest.advanceTimersByTime(1000);
  expect(connect).toHaveBeenCalledTimes(3);
  expect(refresh).not.toHaveBeenCalled();
  expect(warn.mock.calls.map(([message]) => message)).toEqual([
    "Socket handshake refused as unavailable; retrying in 1000 ms",
    "Socket handshake refused as unavailable; retrying in 2000 ms",
    "Socket handshake refused as unavailable; retrying in 1000 ms",
  ]);
});

it("refreshes again after a handshake refused as unavailable", async () => {
  jest.useFakeTimers();
  spyOn(Math, "random").mockReturnValue(0.5);
  const refresh = mock(async () => R.success(true));
  const { socket, connect, disconnect } = attached(refresh);

  await connectError(socket);
  await connectError(socket, new Error("Unavailable"));
  jest.advanceTimersByTime(1000);
  await connectError(socket);

  expect(refresh).toHaveBeenCalledTimes(2);
  expect(connect).toHaveBeenCalledTimes(3);
  expect(disconnect).not.toHaveBeenCalled();
});

it("spreads the retries of sockets refused together", async () => {
  jest.useFakeTimers();
  spyOn(Math, "random").mockReturnValue(0);
  const { socket, connect } = attached();

  await connectError(socket, new Error("Unavailable"));
  jest.advanceTimersByTime(500);

  expect(connect).toHaveBeenCalledTimes(1);
});

it("stops retrying once closed", async () => {
  jest.useFakeTimers();
  const { socket, connect, close } = attached();

  await connectError(socket, new Error("Unavailable"));
  close();
  jest.advanceTimersByTime(30000);

  expect(connect).not.toHaveBeenCalled();
});

it("shares a connection between cookie sockets that never refresh", () => {
  const config = { getWebSocketUrl: () => "http://shared.test" };
  const first = connectMessagingSocket("/a", config);
  const second = connectMessagingSocket("/b", config);
  cleanups.push(first.close, second.close);

  expect(second.socket.io).toBe(first.socket.io);
});

it("ignores another auth error while refresh is pending", async () => {
  let finish!: (value: Result<boolean, Error>) => void;
  const pending = new Promise<Result<boolean, Error>>((resolve) => {
    finish = resolve;
  });
  const refresh = mock(() => pending);
  const { socket, connect } = attached(refresh);

  const firstAttempt = connectError(socket);
  const secondAttempt = connectError(socket, new Error("Unauthorized"));
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(connect).not.toHaveBeenCalled();

  finish(R.success(true));
  await Promise.all([firstAttempt, secondAttempt]);
  expect(connect).toHaveBeenCalledTimes(1);
});

it("ignores a refresh that finishes after cleanup", async () => {
  let finish!: (value: Result<boolean, Error>) => void;
  const pending = new Promise<Result<boolean, Error>>((resolve) => {
    finish = resolve;
  });
  const { socket, connect, close } = attached(() => pending);

  const attempt = connectError(socket);
  close();
  finish(R.success(true));
  await attempt;

  expect(connect).not.toHaveBeenCalled();
  expect(socket.listeners("connect_error")).toHaveLength(0);
  expect(socket.listeners("connect")).toHaveLength(0);
});
