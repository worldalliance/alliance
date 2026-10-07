import { usesMissedSuiteKeyword } from "./missed-suite-keywords";

describe("usesMissedSuiteKeyword", () => {
  it.each(["#{missedactioncontext}", "#{secondmisswarning}"])(
    "detects %s in the email body",
    (keyword) => {
      expect(
        usesMissedSuiteKeyword({
          emailSubject: "Subject",
          emailMessage: `Hi ${keyword}`,
        }),
      ).toBe(true);
    },
  );

  it("detects a keyword in the email subject", () => {
    expect(
      usesMissedSuiteKeyword({
        emailSubject: "#{secondmisswarning}",
        emailMessage: "Body",
      }),
    ).toBe(true);
  });

  it("passes copy without a keyword", () => {
    expect(
      usesMissedSuiteKeyword({
        emailSubject: "#{timeremaining} left",
        emailMessage: "Hi #{firstname}",
      }),
    ).toBe(false);
  });
});
