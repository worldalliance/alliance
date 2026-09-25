import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";
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

export function socketAuthMiddleware(
  jwtService: JwtService,
  logger: Logger,
): Parameters<Server["use"]>[0] {
  return async (socket, next) => {
    try {
      const token = extractTokenFromSocket(socket);
      if (!token) {
        return next(new Error("Unauthorized"));
      }
      const payload = await verifyAccessToken(jwtService, token);
      socket.data.userId = payload.sub;
      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Socket auth failed: ${message}`);
      next(new Error(message));
    }
  };
}
