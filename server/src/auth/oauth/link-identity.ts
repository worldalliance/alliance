import { R, type Result } from "@alliance/common/result";
import { compactDecrypt, CompactEncrypt } from "jose";
import { hkdfSync } from "node:crypto";
import { z } from "zod";

const linkedIdentitySchema = z.object({
  subject: z.string(),
  email: z.string(),
});

export type LinkedIdentity = z.infer<typeof linkedIdentitySchema>;

function linkIdentityKey(): Uint8Array {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set");
  }
  return new Uint8Array(
    hkdfSync("sha256", process.env.JWT_SECRET, "", "oauth-link-identity", 32),
  );
}

export function encryptIdentity(identity: LinkedIdentity): Promise<string> {
  return new CompactEncrypt(new TextEncoder().encode(JSON.stringify(identity)))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(linkIdentityKey());
}

export function decryptIdentity(
  encrypted: string,
): Promise<Result<LinkedIdentity, Error>> {
  return R.fromPromiseFn(async () => {
    const { plaintext } = await compactDecrypt(encrypted, linkIdentityKey());
    return linkedIdentitySchema.parse(
      JSON.parse(new TextDecoder().decode(plaintext)),
    );
  });
}
