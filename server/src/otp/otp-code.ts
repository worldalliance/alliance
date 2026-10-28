import { OTP_CODE_LENGTH } from "@alliance/common/otp";
import ipaddr from "ipaddr.js";
import { createHmac, randomInt } from "node:crypto";
import { deriveServerKey } from "src/utils/server-key";

export function generateOtpCode(): string {
  return randomInt(10 ** OTP_CODE_LENGTH)
    .toString()
    .padStart(OTP_CODE_LENGTH, "0");
}

function keyedDigest(params: { purpose: string; parts: string[] }): string {
  return createHmac("sha256", deriveServerKey(params.purpose))
    .update(JSON.stringify(params.parts))
    .digest("base64url");
}

/**
 * Keyed and bound to the challenge, so a leaked row cannot be brute-forced
 * offline across the million possible codes, nor replayed onto another one.
 */
export function otpCodeDigest(params: {
  challengeId: string;
  destination: string;
  code: string;
}): string {
  return keyedDigest({
    purpose: "otp-code-digest",
    parts: [params.challengeId, params.destination, params.code],
  });
}

export function otpRateBucket(parts: string[]): string {
  return keyedDigest({ purpose: "otp-rate-bucket", parts });
}

/** One client typically holds a whole IPv6 /64, so it shares one bucket. */
export function ipRateKey(ip: string): string {
  if (!ipaddr.isValid(ip)) return ip;
  const parsed = ipaddr.process(ip);
  if (parsed.kind() === "ipv4") return parsed.toString();
  return `${parsed.toNormalizedString().split(":").slice(0, 4).join(":")}::/64`;
}
