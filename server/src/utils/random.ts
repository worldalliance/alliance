import { randomBytes } from "crypto";

/**
 * Generate a random token from `numBytes` of CSPRNG output. Use this instead of
 * `Math.random().toString(36)` for anything that needs to be unguessable or
 * fixed-length (referral codes, CIDs, sids).
 *
 * - `base64url` (default): ~1.33 chars/byte, URL-safe — good for codes that end
 *   up in links.
 * - `hex`: 2 chars/byte — used by the notification/share CIDs.
 */
export function randomToken(
  numBytes: number,
  encoding: "base64url" | "hex" = "base64url",
): string {
  return randomBytes(numBytes).toString(encoding);
}
