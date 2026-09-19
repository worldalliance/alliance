import { isGibberishSpam } from "./join-requests.service";

describe("isGibberishSpam", () => {
  it.each([
    ["MBGWGqqOHmaCfjjXBopsKO", "biJrcBSgyHNPuKeQHjlts"],
    ["hquGQgTSkZWispjmn", "qLafPPcCZIjiVngKZuQtEW"],
  ])("flags random-string name %s and reason %s", (name, reason) => {
    expect(isGibberishSpam({ name, email: "someone@yahoo.com", reason })).toBe(
      true,
    );
  });

  it.each([
    ["Jane Doe", "I want to help organize my neighborhood."],
    ["ChristopherJohnson", "Sustainability"],
    ["MBGWGqqOHmaCfjjXBopsKO", "I heard about you from a friend."],
    ["Jean-Luc McDonald", "qLafPPcCZIjiVngKZuQtEW"],
  ])("passes name %s with reason %s", (name, reason) => {
    expect(
      isGibberishSpam({ name, email: "someone@example.com", reason }),
    ).toBe(false);
  });
});
