import { R, type Result } from "@alliance/common/result";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { Manager, type Socket } from "socket.io-client";
import {
  canEditConversationInfo,
  canEditConversationMembers,
  canLeaveConversation,
  connectMessagingSocket,
  getParticipantState,
  isConversationAdmin,
} from "./messages";
import { makeConversation, makeParticipant } from "./testFixtures";

describe("isConversationAdmin", () => {
  it("stays false for a member of a group that has an owner", () => {
    const conversation = makeConversation([
      makeParticipant(1, "owner"),
      makeParticipant(2, "member"),
    ]);

    expect(isConversationAdmin(conversation, 2)).toBe(false);
  });

  it("is true for the owner themselves", () => {
    const conversation = makeConversation([makeParticipant(1, "owner")]);

    expect(isConversationAdmin(conversation, 1)).toBe(true);
  });

  it("is true for an admin", () => {
    const conversation = makeConversation([makeParticipant(1, "admin")]);

    expect(isConversationAdmin(conversation, 1)).toBe(true);
  });

  it("is false with no signed-in user", () => {
    const conversation = makeConversation([makeParticipant(1, "owner")]);

    expect(isConversationAdmin(conversation, undefined)).toBe(false);
  });

  it("is false with no conversation", () => {
    expect(isConversationAdmin(null, 1)).toBe(false);
  });
});

describe("getParticipantState", () => {
  it("is invited for an invited participant", () => {
    const conversation = makeConversation([
      makeParticipant(1, "owner"),
      { ...makeParticipant(2, "member"), state: "invited" },
    ]);

    expect(getParticipantState(conversation, 2)).toBe("invited");
  });

  it("is joined for a joined participant", () => {
    const conversation = makeConversation([makeParticipant(1, "member")]);

    expect(getParticipantState(conversation, 1)).toBe("joined");
  });

  it("is null for a user outside the conversation", () => {
    const conversation = makeConversation([makeParticipant(1, "owner")]);

    expect(getParticipantState(conversation, 2)).toBeNull();
  });

  it("is null with no signed-in user", () => {
    const conversation = makeConversation([makeParticipant(1, "owner")]);

    expect(getParticipantState(conversation, undefined)).toBeNull();
  });

  it("is null with no conversation", () => {
    expect(getParticipantState(null, 1)).toBeNull();
  });
});

describe("canEditConversationInfo", () => {
  it("is true for an admin of a group", () => {
    const conversation = makeConversation([
      makeParticipant(1, "owner"),
      makeParticipant(2, "member"),
    ]);

    expect(canEditConversationInfo(conversation, 1)).toBe(true);
  });

  it("is false for a member of a group", () => {
    const conversation = makeConversation([
      makeParticipant(1, "owner"),
      makeParticipant(2, "member"),
    ]);

    expect(canEditConversationInfo(conversation, 2)).toBe(false);
  });

  it("is false for an admin of a community chat", () => {
    const conversation = makeConversation(
      [makeParticipant(1, "admin"), makeParticipant(2, "member")],
      "community",
    );

    expect(canEditConversationInfo(conversation, 1)).toBe(false);
  });

  it("is false for a direct conversation", () => {
    const conversation = makeConversation(
      [makeParticipant(1, "admin"), makeParticipant(2, "member")],
      "direct",
    );

    expect(canEditConversationInfo(conversation, 1)).toBe(false);
  });

  it("is false with no conversation", () => {
    expect(canEditConversationInfo(null, 1)).toBe(false);
  });
});

describe("canEditConversationMembers", () => {
  it("is true for an admin of a group", () => {
    const conversation = makeConversation([
      makeParticipant(1, "owner"),
      makeParticipant(2, "member"),
    ]);

    expect(canEditConversationMembers(conversation, 1)).toBe(true);
  });

  it("is false for a member of a group", () => {
    const conversation = makeConversation([
      makeParticipant(1, "owner"),
      makeParticipant(2, "member"),
    ]);

    expect(canEditConversationMembers(conversation, 2)).toBe(false);
  });

  it("is false for an admin of a community chat", () => {
    const conversation = makeConversation(
      [makeParticipant(1, "admin"), makeParticipant(2, "member")],
      "community",
    );

    expect(canEditConversationMembers(conversation, 1)).toBe(false);
  });

  it("is false for a direct conversation", () => {
    const conversation = makeConversation(
      [makeParticipant(1, "admin"), makeParticipant(2, "member")],
      "direct",
    );

    expect(canEditConversationMembers(conversation, 1)).toBe(false);
  });

  it("is false with no conversation", () => {
    expect(canEditConversationMembers(null, 1)).toBe(false);
  });
});

describe("canLeaveConversation", () => {
  it("is true for a group", () => {
    expect(canLeaveConversation(makeConversation([]))).toBe(true);
  });

  it("is false for a community chat", () => {
    expect(canLeaveConversation(makeConversation([], "community"))).toBe(false);
  });

  it("is false for a direct conversation", () => {
    expect(canLeaveConversation(makeConversation([], "direct"))).toBe(false);
  });

  it("is false with no conversation", () => {
    expect(canLeaveConversation(null)).toBe(false);
  });
});

const cleanups: (() => void)[] = [];

beforeEach(() => {
  spyOn(Manager.prototype, "open").mockImplementation(function (this: Manager) {
    return this;
  });
});

afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  mock.restore();
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

it("registers no listeners without a refresh callback", () => {
  const { socket } = attached();

  expect(socket.listeners("connect_error")).toHaveLength(0);
  expect(socket.listeners("connect")).toHaveLength(0);
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
