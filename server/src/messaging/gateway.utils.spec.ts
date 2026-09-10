import { Socket } from "socket.io";
import { ACCESS_COOKIE } from "src/auth/tokens";
import { extractTokenFromSocket } from "./gateway.utils";

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
          query: { token: "query" },
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
          query: { token: "query" },
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
          query: { token: "query" },
        }),
      ),
    ).toBe("cookie");
  });

  it("falls back to the query token", () => {
    expect(
      extractTokenFromSocket(
        socket({
          headers: { cookie: "other=cookie" },
          query: { token: "query" },
        }),
      ),
    ).toBe("query");
  });

  it("returns undefined when the handshake carries nothing", () => {
    expect(extractTokenFromSocket(socket({}))).toBeUndefined();
  });
});
