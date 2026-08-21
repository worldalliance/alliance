import { Socket } from "socket.io";
import { AuthService } from "src/auth/auth.service";

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

  const header = client.handshake?.headers?.authorization;
  if (typeof header === "string") {
    const [type, token] = header.split(" ");
    if (type === "Bearer" && token) {
      return token;
    }
  }

  const cookieHeader = client.handshake?.headers?.cookie;
  if (typeof cookieHeader === "string") {
    const cookies = parseCookies(cookieHeader);
    const cookieToken = cookies[AuthService.ACCESS_COOKIE];
    if (cookieToken) {
      return cookieToken;
    }
  }

  const queryToken = client.handshake?.query?.token;
  if (typeof queryToken === "string") {
    return queryToken;
  }

  return undefined;
}
