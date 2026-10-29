import { milliseconds } from "date-fns";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const OAUTH_STATE_LIFETIME = "10m";

/** Outlives the state token it guards, so a slow consent screen still lands. */
export const OAUTH_PROOF_MAX_AGE_MS = milliseconds({ minutes: 15 });

export type OAuthProof = {
  proof: string;
  proofHash: string;
};

export function mintProof(): OAuthProof {
  const proof = randomBytes(32).toString("base64url");
  return { proof, proofHash: hashProof(proof) };
}

function hashProof(proof: string): string {
  return createHash("sha256").update(proof).digest("base64url");
}

export function proofMatches(proof: string, proofHash: string): boolean {
  const presented = Buffer.from(hashProof(proof));
  const expected = Buffer.from(proofHash);
  return (
    presented.length === expected.length && timingSafeEqual(presented, expected)
  );
}

/**
 * One cookie holds the flows this browser has open, newest first, because a
 * member with the login page in one tab and signup in another must be able to
 * finish either. Base64url never contains the separator.
 */
const PROOF_SEPARATOR = ",";
const CONCURRENT_FLOWS = 3;

export function addProof(params: {
  proof: string;
  presented: string | undefined;
}): string {
  const open = params.presented ? params.presented.split(PROOF_SEPARATOR) : [];
  return [params.proof, ...open]
    .slice(0, CONCURRENT_FLOWS)
    .join(PROOF_SEPARATOR);
}

/**
 * The proofs left once this flow's is spent, or null if it holds none. Callers
 * leave the cookie untouched on null, so a stray callback cannot retire the
 * flows this browser still has open.
 */
export function spendProof(params: {
  presented: string | undefined;
  proofHash: string;
}): string | null {
  const open = params.presented ? params.presented.split(PROOF_SEPARATOR) : [];
  const spent = open.findIndex((proof) =>
    proofMatches(proof, params.proofHash),
  );
  if (spent === -1) {
    return null;
  }
  return open.filter((_, index) => index !== spent).join(PROOF_SEPARATOR);
}
