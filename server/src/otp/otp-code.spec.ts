import { generateOtpCode, ipRateKey, otpCodeDigest } from "./otp-code";

describe("generateOtpCode", () => {
  it("is six digits, keeping leading zeros", () => {
    const codes = Array.from({ length: 2000 }, generateOtpCode);
    expect(codes.every((code) => /^\d{6}$/.test(code))).toBe(true);
    expect(codes.some((code) => code.startsWith("0"))).toBe(true);
  });
});

describe("otpCodeDigest", () => {
  const base = {
    challengeId: "c1",
    destination: "a@example.com",
    code: "012345",
  };

  beforeAll(() => {
    process.env.JWT_SECRET ??= "test-secret";
  });

  it("is stable and never contains the code", () => {
    expect(otpCodeDigest(base)).toBe(otpCodeDigest(base));
    expect(otpCodeDigest(base)).not.toContain(base.code);
  });

  it.each([
    ["challenge", { challengeId: "c2" }],
    ["destination", { destination: "b@example.com" }],
    ["code", { code: "012346" }],
  ])("changes with the %s", (_label, change) => {
    expect(otpCodeDigest({ ...base, ...change })).not.toBe(otpCodeDigest(base));
  });

  it("depends on the server secret", () => {
    const before = otpCodeDigest(base);
    const secret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = `${secret}-rotated`;
    try {
      expect(otpCodeDigest(base)).not.toBe(before);
    } finally {
      process.env.JWT_SECRET = secret;
    }
  });
});

describe("ipRateKey", () => {
  it("shares one key across an IPv6 /64", () => {
    expect(ipRateKey("2001:db8:1:2:aaaa::1")).toBe(
      ipRateKey("2001:0db8:0001:0002:ffff:ffff:ffff:ffff"),
    );
    expect(ipRateKey("2001:db8:1:2::1")).not.toBe(ipRateKey("2001:db8:1:3::1"));
  });

  it("keys an IPv4-mapped address as the IPv4 address", () => {
    expect(ipRateKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });
});
