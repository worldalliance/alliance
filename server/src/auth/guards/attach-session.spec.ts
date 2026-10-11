import { type Type, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { type RequestContext, requestContext } from "src/utils/request-context";
import { Public } from "../public.decorator";
import type { SessionService } from "../session.service";
import { JWTTokenType } from "../tokens";
import { attachSession } from "./attach-session";
import { AuthGuard } from "./auth.guard";
import { AuthOptionalGuard } from "./authoptional.guard";
import { RefreshTokenGuard } from "./refresh.guard";

const session = {
  sub: 7,
  email: "member@example.com",
  tokenType: JWTTokenType.access,
};

// attachSession only writes the user field.
const emptyRequest = (): Request => ({}) as Request;

describe("attachSession", () => {
  it("puts the session on the request and its user id on the request context", () => {
    const request = emptyRequest();
    const ctx = { requestId: "r", method: "GET", url: "/" };

    requestContext.run(ctx, () => attachSession(request, session));

    expect(request["user"]).toBe(session);
    expect(ctx).toHaveProperty("userId", 7);
  });

  it("puts the session on the request outside a request context", () => {
    const request = emptyRequest();

    attachSession(request, session);

    expect(request["user"]).toBe(session);
  });
});

// The guards only call assertCurrent, and the private repository keeps a literal from being assignable.
const currentSessions = {} as SessionService;
currentSessions.assertCurrent = () => Promise.resolve();

const endedSessions = {} as SessionService;
endedSessions.assertCurrent = () => Promise.reject(new UnauthorizedException());

const lookupError = new Error("connection terminated");
const failingSessions = {} as SessionService;
failingSessions.assertCurrent = () => Promise.reject(lookupError);

describe("token-verifying guards", () => {
  const jwtService = new JwtService();
  const env = { ...process.env };

  beforeEach(() => {
    process.env.JWT_SECRET = "access-secret";
    process.env.JWT_REFRESH_SECRET = "refresh-secret";
  });

  afterEach(() => {
    process.env = { ...env };
  });

  const userIdAfter = async (params: {
    guard: { canActivate: (context: ExecutionContextHost) => Promise<boolean> };
    headers: Record<string, string>;
  }) => {
    const request = { headers: params.headers, cookies: {} };
    const context = new ExecutionContextHost([request], Object, () => {});
    const ctx: RequestContext = { requestId: "r", method: "POST", url: "/" };
    await requestContext.run(ctx, () => params.guard.canActivate(context));
    return ctx.userId;
  };

  it("AuthOptionalGuard stamps the user id on the request context", async () => {
    const token = await jwtService.signAsync(
      { ...session, sub: 9 },
      { secret: "access-secret" },
    );

    expect(
      await userIdAfter({
        guard: new AuthOptionalGuard(
          jwtService,
          new Reflector(),
          currentSessions,
        ),
        headers: { authorization: `Bearer ${token}` },
      }),
    ).toBe(9);
  });

  it("RefreshTokenGuard stamps the user id on the request context", async () => {
    const token = await jwtService.signAsync(
      { ...session, sub: 9, tokenType: JWTTokenType.refresh },
      { secret: "refresh-secret" },
    );

    expect(
      await userIdAfter({
        guard: new RefreshTokenGuard(jwtService, currentSessions),
        headers: { authorization: `Bearer ${token}` },
      }),
    ).toBe(9);
  });

  it.each([
    [
      "AuthGuard",
      new AuthGuard(jwtService, new Reflector(), failingSessions),
      JWTTokenType.access,
      "access-secret",
    ],
    [
      "AuthOptionalGuard",
      new AuthOptionalGuard(jwtService, new Reflector(), failingSessions),
      JWTTokenType.access,
      "access-secret",
    ],
    [
      "RefreshTokenGuard",
      new RefreshTokenGuard(jwtService, failingSessions),
      JWTTokenType.refresh,
      "refresh-secret",
    ],
  ] as const)(
    "%s passes a failed session lookup on instead of refusing the token",
    async (_name, guard, tokenType, secret) => {
      const token = await jwtService.signAsync(
        { ...session, tokenType },
        { secret },
      );
      await expect(
        userIdAfter({ guard, headers: { authorization: `Bearer ${token}` } }),
      ).rejects.toBe(lookupError);
    },
  );

  describe("AuthGuard and AuthOptionalGuard", () => {
    @Public()
    class PublicController {}

    class PrivateController {}

    const authGuard = new AuthGuard(
      jwtService,
      new Reflector(),
      currentSessions,
    );
    const optionalGuard = new AuthOptionalGuard(
      jwtService,
      new Reflector(),
      currentSessions,
    );
    const guards = Object.entries({
      AuthGuard: authGuard,
      AuthOptionalGuard: optionalGuard,
    });

    const activate = (params: {
      guard: AuthGuard | AuthOptionalGuard;
      controller: Type;
      headers?: Record<string, string>;
    }) => {
      const request = { headers: params.headers ?? {}, cookies: {} };
      return params.guard.canActivate(
        new ExecutionContextHost([request], params.controller, () => {}),
      );
    };

    it.each(guards)(
      "%s lets a @Public route through without verifying its token",
      async (_name, guard) => {
        expect(
          await activate({
            guard,
            controller: PublicController,
            headers: { authorization: "Bearer not-a-jwt" },
          }),
        ).toBe(true);
      },
    );

    it.each(guards)(
      "%s refuses a token that does not verify",
      async (_name, guard) => {
        await expect(
          activate({
            guard,
            controller: PrivateController,
            headers: { authorization: "Bearer not-a-jwt" },
          }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      },
    );

    it.each([
      ["AuthGuard", new AuthGuard(jwtService, new Reflector(), endedSessions)],
      [
        "AuthOptionalGuard",
        new AuthOptionalGuard(jwtService, new Reflector(), endedSessions),
      ],
    ] as const)(
      "%s refuses a verified token whose session has ended",
      async (_name, guard) => {
        const token = await jwtService.signAsync(session, {
          secret: "access-secret",
        });
        await expect(
          activate({
            guard,
            controller: PrivateController,
            headers: { authorization: `Bearer ${token}` },
          }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      },
    );

    it("only AuthOptionalGuard lets a request without a token through", async () => {
      await expect(
        activate({ guard: authGuard, controller: PrivateController }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(
        await activate({ guard: optionalGuard, controller: PrivateController }),
      ).toBe(true);
    });
  });
});
