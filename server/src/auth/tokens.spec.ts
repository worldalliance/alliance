import type { Request } from "express";
import type { IncomingHttpHeaders } from "node:http";
import {
  extractBearerToken,
  extractGuestToken,
  extractRefreshToken,
} from "./tokens";

describe("extractBearerToken", () => {
  it("reads the token out of a Bearer header", () => {
    expect(extractBearerToken("Bearer token")).toBe("token");
  });

  it.each(["Basic token", "bearer token", "token", "Bearer", "", undefined])(
    "returns undefined for %p",
    (header) => {
      expect(extractBearerToken(header)).toBeUndefined();
    },
  );
});

// The extractors read only these two fields off the request.
const request = (
  headers: IncomingHttpHeaders,
  cookies: Record<string, string>,
): Request => ({ headers, cookies }) as Request;

describe("extractRefreshToken", () => {
  it("prefers the cookie over the Bearer header", () => {
    expect(
      extractRefreshToken(
        request(
          { authorization: "Bearer header" },
          { refresh_token: "cookie" },
        ),
      ),
    ).toBe("cookie");
  });

  it("falls back to the Bearer header", () => {
    expect(
      extractRefreshToken(request({ authorization: "Bearer header" }, {})),
    ).toBe("header");
  });

  it("ignores a header carrying another scheme", () => {
    expect(
      extractRefreshToken(request({ authorization: "Basic header" }, {})),
    ).toBeUndefined();
  });

  it("returns undefined when neither is set", () => {
    expect(extractRefreshToken(request({}, {}))).toBeUndefined();
  });
});

describe("extractGuestToken", () => {
  it("prefers the header over the cookie", () => {
    expect(
      extractGuestToken(
        request({ "x-guest-token": "header" }, { guest_token: "cookie" }),
      ),
    ).toBe("header");
  });

  it("falls back to the cookie", () => {
    expect(extractGuestToken(request({}, { guest_token: "cookie" }))).toBe(
      "cookie",
    );
  });

  it("falls back to the cookie when the header is empty", () => {
    expect(
      extractGuestToken(
        request({ "x-guest-token": "" }, { guest_token: "cookie" }),
      ),
    ).toBe("cookie");
  });

  it("returns undefined with neither", () => {
    expect(extractGuestToken(request({}, {}))).toBeUndefined();
  });
});
