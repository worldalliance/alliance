import { thrownMessage } from "@alliance/common/errorMessage";
import { R } from "@alliance/common/result";
import { Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";
import type { SessionService } from "src/auth/session.service";
import {
  ACCESS_COOKIE,
  extractBearerToken,
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

export function socketAuthMiddleware(params: {
  jwtService: JwtService;
  sessionService: SessionService;
  logger: Logger;
}): Parameters<Server["use"]>[0] {
  const { jwtService, sessionService, logger } = params;
  return async (socket, next) => {
    const token = extractTokenFromSocket(socket);
    if (!token) {
      return next(new Error("Unauthorized"));
    }
    const payload = await R.fromPromise(verifyAccessToken(jwtService, token));
    if (!payload.ok) {
      logger.warn(`Socket auth failed: ${payload.error.message}`);
      return next(new Error(payload.error.message));
    }
    const current = await R.fromPromise(
      sessionService.assertCurrent(payload.value),
    );
    if (!current.ok) {
      if (current.error instanceof UnauthorizedException) {
        return next(new Error("Unauthorized"));
      }
      // Clients retry a refused handshake only once, after a token refresh,
      // and deleting the account afterwards still disconnects this socket.
      logger.error(
        `Socket session check failed; accepting the verified token: ${thrownMessage(current.error)}`,
      );
    }
    socket.data.userId = payload.value.sub;
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
