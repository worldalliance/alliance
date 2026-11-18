import { Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Socket } from "socket.io";
import type { SessionService } from "src/auth/session.service";
import { ACCESS_COOKIE, JWTTokenType } from "src/auth/tokens";
import { User } from "src/user/entities/user.entity";
import {
  adminSocketAuthMiddleware,
  extractTokenFromSocket,
  socketAuthMiddleware,
} from "./gateway.utils";

// extractTokenFromSocket reads only the handshake off the socket.
const socket = (handshake: Partial<Socket["handshake"]>): Socket =>
  ({ handshake }) as Socket;

describe("extractTokenFromSocket", () => {
  it("prefers the handshake auth token", () => {
    expect(
      extractTokenFromSocket(
        socket({
          auth: { token: "auth" },
          headers: {
            authorization: "Bearer header",
            cookie: `${ACCESS_COOKIE}=cookie`,
          },
        }),
      ),
    ).toBe("auth");
  });

  it("falls back to the Bearer header", () => {
    expect(
      extractTokenFromSocket(
        socket({
          headers: {
            authorization: "Bearer header",
            cookie: `${ACCESS_COOKIE}=cookie`,
          },
        }),
      ),
    ).toBe("header");
  });

  it("skips a header carrying another scheme", () => {
    expect(
      extractTokenFromSocket(
        socket({
          headers: {
            authorization: "Basic header",
            cookie: `${ACCESS_COOKIE}=cookie`,
          },
        }),
      ),
    ).toBe("cookie");
  });

  it("falls back to the access cookie", () => {
    expect(
      extractTokenFromSocket(
        socket({
          headers: { cookie: `${ACCESS_COOKIE}=cookie` },
        }),
      ),
    ).toBe("cookie");
  });

  it("ignores a query token", () => {
    expect(
      extractTokenFromSocket(
        socket({
          headers: { cookie: "other=cookie" },
          query: { token: "query" },
        }),
      ),
    ).toBeUndefined();
  });

  it("returns undefined when the handshake carries nothing", () => {
    expect(extractTokenFromSocket(socket({}))).toBeUndefined();
  });
});

const jwtService = new JwtService();
const env = { ...process.env };

beforeEach(() => {
  process.env.JWT_SECRET = "access-secret";
});

afterEach(() => {
  process.env = { ...env };
});

describe("socketAuthMiddleware", () => {
  // The middleware only calls assertCurrent, and the private repository keeps a literal from being assignable.
  const handshake = async (
    assertCurrent: SessionService["assertCurrent"],
    tokenType = JWTTokenType.access,
  ) => {
    const sessionService = {} as SessionService;
    sessionService.assertCurrent = assertCurrent;
    const token = await jwtService.signAsync(
      { sub: 7, email: "member@example.com", tokenType },
      { secret: "access-secret" },
    );
    const connecting = Object.assign(socket({ auth: { token } }), {
      data: {},
    });
    const errors: (Error | undefined)[] = [];
    await socketAuthMiddleware({
      jwtService,
      sessionService,
      logger: new Logger("test"),
    })(connecting, (error?: Error) => errors.push(error));
    return { errors, userId: connecting.data.userId };
  };

  it("refuses a verified token whose session has ended", async () => {
    expect(
      await handshake(() => Promise.reject(new UnauthorizedException())),
    ).toEqual({ errors: [new Error("Unauthorized")], userId: undefined });
  });

  it("refuses a token of a type that can't authenticate as unauthorized", async () => {
    expect(
      await handshake(() => Promise.resolve(), JWTTokenType.refresh),
    ).toEqual({
      errors: [new Error("Unauthorized")],
      userId: undefined,
    });
  });

  it("accepts a verified token when the session check itself fails", async () => {
    const log = jest.spyOn(Logger.prototype, "error").mockImplementation();
    expect(
      await handshake(() => Promise.reject(new Error("connection terminated"))),
    ).toEqual({ errors: [undefined], userId: 7 });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("adminSocketAuthMiddleware", () => {
  const signed = (options: { secret?: string; expiresIn?: number } = {}) =>
    jwtService.signAsync(
      { sub: 7, email: "admin@example.com", tokenType: JWTTokenType.access },
      { secret: "access-secret", ...options },
    );

  // The middleware only calls currentUser, and the private repository keeps a literal SessionService from being assignable.
  const handshake = async (
    currentUser: () => Promise<User>,
    token: Promise<string | undefined> = signed(),
  ) => {
    const sessions: number[] = [];
    const sessionService = {} as SessionService;
    sessionService.currentUser = async (session) => {
      sessions.push(session.sub);
      return currentUser();
    };
    const connecting = Object.assign(
      socket({ auth: { token: await token }, headers: {} }),
      { data: {} },
    );
    const errors: (Error | undefined)[] = [];
    await adminSocketAuthMiddleware({
      jwtService,
      sessionService,
      logger: new Logger("test"),
    })(connecting, (error?: Error) => errors.push(error));
    return { errors, data: connecting.data, sessions };
  };

  const admin = async () => new User({ id: 7, name: "Sam", admin: true });

  it("accepts a current admin and records who they are", async () => {
    expect(await handshake(admin)).toEqual({
      errors: [undefined],
      data: { userId: 7, name: "Sam" },
      sessions: [7],
    });
  });

  it("refuses a member who isn't an admin", async () => {
    expect(
      await handshake(
        async () => new User({ id: 7, name: "Sam", admin: false }),
      ),
    ).toEqual({ errors: [new Error("Forbidden")], data: {}, sessions: [7] });
  });

  it.each([
    ["no token", Promise.resolve(undefined)],
    ["a token signed with another secret", signed({ secret: "forged" })],
    ["an expired token", signed({ expiresIn: -1 })],
  ])("refuses %s without checking the session", async (_, token) => {
    expect(await handshake(admin, token)).toEqual({
      errors: [new Error("Unauthorized")],
      data: {},
      sessions: [],
    });
  });

  it("refuses a session that is no longer current as unauthorized", async () => {
    expect(
      await handshake(() => Promise.reject(new UnauthorizedException())),
    ).toEqual({ errors: [new Error("Unauthorized")], data: {}, sessions: [7] });
  });

  it("refuses as unavailable when the session check itself fails", async () => {
    const log = jest.spyOn(Logger.prototype, "error").mockImplementation();
    expect(
      await handshake(() => Promise.reject(new Error("connection terminated"))),
    ).toEqual({ errors: [new Error("Unavailable")], data: {}, sessions: [7] });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
