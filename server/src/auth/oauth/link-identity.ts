import { R, type Result } from "@alliance/common/result";
import { compactDecrypt, CompactEncrypt } from "jose";
import { deriveServerKey } from "src/utils/server-key";
import { z } from "zod";

const linkedIdentitySchema = z.object({
  subject: z.string(),
  email: z.string(),
});

export type LinkedIdentity = z.infer<typeof linkedIdentitySchema>;

function linkIdentityKey(): Uint8Array {
  return deriveServerKey("oauth-link-identity");
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
