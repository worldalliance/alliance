import { refusesReviewAccounts } from "./review-account";

describe("refusesReviewAccounts", () => {
  const env = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = env;
  });

  it.each([
    ["production", true],
    ["staging", false],
    ["development", false],
    ["test", false],
  ])("NODE_ENV=%p refuses: %p", (nodeEnv, refuses) => {
    process.env.NODE_ENV = nodeEnv;
    expect(refusesReviewAccounts()).toBe(refuses);
  });

  it("throws on an unknown NODE_ENV", () => {
    process.env.NODE_ENV = "prod";
    expect(() => refusesReviewAccounts()).toThrow("NODE_ENV");
  });
});
