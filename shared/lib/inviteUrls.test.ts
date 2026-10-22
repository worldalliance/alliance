import { getInviteLandingUrl } from "./inviteUrls";

describe("getInviteLandingUrl", () => {
  it("sends the code to the homepage, encoded", () => {
    expect(getInviteLandingUrl("https://example.org/", "a b&c")).toBe(
      "https://example.org/?ref=a%20b%26c",
    );
  });
});
