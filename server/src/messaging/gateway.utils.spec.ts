import { Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Socket } from "socket.io";
import type { SessionService } from "src/auth/session.service";
import { ACCESS_COOKIE, JWTTokenType } from "src/auth/tokens";
import { extractTokenFromSocket, socketAuthMiddleware } from "./gateway.utils";

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

describe("socketAuthMiddleware", () => {
  const jwtService = new JwtService();
  const env = { ...process.env };

  beforeEach(() => {
    process.env.JWT_SECRET = "access-secret";
  });

  afterEach(() => {
    process.env = { ...env };
  });

  // The middleware only calls assertCurrent, and the private repository keeps a literal from being assignable.
  const handshake = async (assertCurrent: SessionService["assertCurrent"]) => {
    const sessionService = {} as SessionService;
    sessionService.assertCurrent = assertCurrent;
    const token = await jwtService.signAsync(
      { sub: 7, email: "member@example.com", tokenType: JWTTokenType.access },
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

  it("accepts a verified token when the session check itself fails", async () => {
    const log = jest.spyOn(Logger.prototype, "error").mockImplementation();
    expect(
      await handshake(() => Promise.reject(new Error("connection terminated"))),
    ).toEqual({ errors: [undefined], userId: 7 });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
