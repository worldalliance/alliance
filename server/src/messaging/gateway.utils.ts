import { thrownMessage } from "@alliance/common/errorMessage";
import { R, type Result } from "@alliance/common/result";
import { SocketRefusal } from "@alliance/common/socketRefusal";
import { Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";
import type { SessionService } from "src/auth/session.service";
import {
  ACCESS_COOKIE,
  extractBearerToken,
  type JwtPayload,
  verifyAccessToken,
} from "src/auth/tokens";

export function parseCookies(cookieHeader: string): Record<string, string> {
  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [name, ...rest] = part.split("=");
    if (!name || !rest.length) {
      return acc;
    }
    acc[name.trim()] = rest.join("=").trim();
    return acc;
  }, {});
}

export function extractTokenFromSocket(client: Socket): string | undefined {
  const authToken = client.handshake?.auth?.token as string | undefined;
  if (authToken) {
    return authToken;
  }

  const bearerToken = extractBearerToken(
    client.handshake?.headers?.authorization,
  );
  if (bearerToken) {
    return bearerToken;
  }

  const cookieHeader = client.handshake?.headers?.cookie;
  if (typeof cookieHeader === "string") {
    const cookies = parseCookies(cookieHeader);
    const cookieToken = cookies[ACCESS_COOKIE];
    if (cookieToken) {
      return cookieToken;
    }
  }

  return undefined;
}

/** A missing token fails as UnauthorizedException. */
async function verifySocketToken(params: {
  socket: Socket;
  jwtService: JwtService;
  logger: Logger;
}): Promise<Result<JwtPayload, Error>> {
  const { socket, jwtService, logger } = params;
  const token = extractTokenFromSocket(socket);
  if (!token) return R.failure(new UnauthorizedException());
  const payload = await R.fromPromise(verifyAccessToken(jwtService, token));
  if (!payload.ok) logger.warn(`Socket auth failed: ${payload.error.message}`);
  return payload;
}

export function socketAuthMiddleware(params: {
  jwtService: JwtService;
  sessionService: SessionService;
  logger: Logger;
}): Parameters<Server["use"]>[0] {
  const { jwtService, sessionService, logger } = params;
  return async (socket, next) => {
    const payload = await verifySocketToken({ socket, jwtService, logger });
    if (!payload.ok) {
      return next(
        new Error(
          payload.error instanceof UnauthorizedException
            ? SocketRefusal.Unauthorized
            : payload.error.message,
        ),
      );
    }
    const current = await R.fromPromise(
      sessionService.assertCurrent(payload.value),
    );
    if (!current.ok) {
      if (current.error instanceof UnauthorizedException) {
        return next(new Error(SocketRefusal.Unauthorized));
      }
      // Deleting the account afterwards still disconnects this socket, and
      // mobile builds installed before the "Unavailable" retry reconnect after
      // a refusal only by refreshing their token, which can't fix a check that
      // errored.
      logger.error(
        `Socket session check failed; accepting the verified token: ${thrownMessage(current.error)}`,
      );
    }
    socket.data.userId = payload.value.sub;
    next();
  };
}

/** Accepts only a current admin session and sets `socket.data.userId` and
 * `socket.data.name`. */
export function adminSocketAuthMiddleware(params: {
  jwtService: JwtService;
  sessionService: SessionService;
  logger: Logger;
}): Parameters<Server["use"]>[0] {
  const { jwtService, sessionService, logger } = params;
  return async (socket, next) => {
    const payload = await verifySocketToken({ socket, jwtService, logger });
    // Every token failure is Unauthorized, the refusal clients refresh their
    // session on; this middleware never passes on "jwt expired".
    if (!payload.ok) return next(new Error(SocketRefusal.Unauthorized));
    const user = await R.fromPromise(sessionService.currentUser(payload.value));
    if (!user.ok) {
      if (user.error instanceof UnauthorizedException) {
        return next(new Error(SocketRefusal.Unauthorized));
      }
      logger.error(
        `Admin socket session check failed: ${thrownMessage(user.error)}`,
      );
      return next(new Error(SocketRefusal.Unavailable));
    }
    if (!user.value.admin) return next(new Error(SocketRefusal.Forbidden));
    socket.data.userId = user.value.id;
    socket.data.name = user.value.name;
    next();
  };
}

export async function disconnectUserSockets(params: {
  server: Server;
  userId: number;
  logger: Logger;
}): Promise<void> {
  const { server, userId, logger } = params;
  try {
    for (const socket of await server.fetchSockets()) {
      if (socket.data.userId === userId) {
        socket.disconnect(true);
      }
    }
  } catch (error) {
    logger.warn(
      `Failed to disconnect deleted user ${userId}: ${thrownMessage(error)}`,
    );
  }
}
