import { hkdfSync } from "node:crypto";
import { env } from "../config/env";

export function deriveServerKey(info: string): Buffer {
  return Buffer.from(hkdfSync("sha256", env("JWT_SECRET"), "", info, 32));
}
