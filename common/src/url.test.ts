import { urlMatchesDomain } from "./url";

describe("urlMatchesDomain", () => {
  it("matches the domain itself and its subdomains", () => {
    expect(urlMatchesDomain("https://linkedin.com/in/x", "linkedin.com")).toBe(
      true,
    );
    expect(
      urlMatchesDomain("https://www.linkedin.com/in/x", "linkedin.com"),
    ).toBe(true);
  });

  it("tolerates scheme-less input", () => {
    expect(urlMatchesDomain("linkedin.com/in/x", "linkedin.com")).toBe(true);
    expect(urlMatchesDomain("www.linkedin.com", "linkedin.com")).toBe(true);
  });

  it("ignores the domain elsewhere in the url", () => {
    expect(
      urlMatchesDomain("https://evil.com/linkedin.com", "linkedin.com"),
    ).toBe(false);
    expect(
      urlMatchesDomain("https://evil.com/?u=linkedin.com", "linkedin.com"),
    ).toBe(false);
    expect(
      urlMatchesDomain("https://linkedin.com.evil.com/x", "linkedin.com"),
    ).toBe(false);
  });

  it("is false for non-matching or unparseable values", () => {
    expect(urlMatchesDomain("https://example.com", "linkedin.com")).toBe(false);
    expect(urlMatchesDomain("", "linkedin.com")).toBe(false);
    expect(urlMatchesDomain("   ", "linkedin.com")).toBe(false);
  });
});
