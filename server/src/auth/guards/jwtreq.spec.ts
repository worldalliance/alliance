import type { Request } from "express";
import type { IncomingHttpHeaders } from "node:http";
import { extractGuestToken } from "./jwtreq";

// extractGuestToken reads only these two fields off the request.
const request = (
  headers: IncomingHttpHeaders,
  cookies: Record<string, string>,
): Request => ({ headers, cookies }) as Request;

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
