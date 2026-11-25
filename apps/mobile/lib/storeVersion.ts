import type { MobilePlatformFingerprintDto } from "@alliance/shared/client";

// Strictly greater, e.g. isNewerVersion("1.3.0", "1.2.9") === true. Malformed
// input yields NaN parts, every comparison against NaN is false, and the
// function returns false — i.e. fails safe to "don't prompt".
export function isNewerVersion(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const ai = pa[i] ?? 0;
    const bi = pb[i] ?? 0;
    if (ai > bi) return true;
    if (ai < bi) return false;
  }
  return false;
}

/**
 * Compares this build's EAS Update runtime fingerprint against the store-build
 * fingerprint reported by the server. A mismatch means a store build exists
 * that this install can't reach over OTA — but fingerprints are unordered
 * hashes, so a mismatch alone can't distinguish "this install is behind the
 * store" from "the server's baseline hasn't caught up to this build yet" (the
 * deploy window right after a release). The store build's semver breaks the
 * tie: only a strictly newer version counts.
 */
export function isNewerStoreBuild(params: {
  storeBuild: MobilePlatformFingerprintDto | null;
  installedFingerprint: string | null;
  installedVersion: string | null;
}): boolean {
  const { storeBuild, installedFingerprint, installedVersion } = params;
  return Boolean(
    storeBuild?.fingerprint &&
    installedFingerprint &&
    installedVersion &&
    storeBuild.fingerprint !== installedFingerprint &&
    isNewerVersion(storeBuild.version, installedVersion),
  );
}
