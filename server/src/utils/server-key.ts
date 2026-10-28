import { hkdfSync } from "node:crypto";

export function deriveServerKey(info: string): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return Buffer.from(hkdfSync("sha256", secret, "", info, 32));
}
