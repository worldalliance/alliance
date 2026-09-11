import { Socket } from "socket.io";
import { ACCESS_COOKIE, extractBearerToken } from "src/auth/tokens";

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
