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
    ["prod", true],
    [undefined, true],
  ])("NODE_ENV=%p refuses: %p", (nodeEnv, refuses) => {
    if (nodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = nodeEnv;
    }

    expect(refusesReviewAccounts()).toBe(refuses);
  });
});
