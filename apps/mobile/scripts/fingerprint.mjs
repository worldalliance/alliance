// EAS Update fingerprint (runtimeVersion) tooling.
//
//   node scripts/fingerprint.mjs                    # print hashes
//   node scripts/fingerprint.mjs check              # exit 3 on drift
//   node scripts/fingerprint.mjs capture <build>... # record pending hashes
//   node scripts/fingerprint.mjs promote [platform] # pending -> live baseline
//   node scripts/fingerprint.mjs update <build>     # set live baseline
//   node scripts/fingerprint.mjs artifact <build>   # print a build's hash
//
// Exit codes: 0 OK, 3 drift, other nonzero tool failure. Drift uses a
// dedicated code so CI never reports an infra/tool failure as native drift.
//
// Drift means native changes need a store build. Live baselines are in
// common/src/mobileFingerprints.gen.ts; promote only after store release so
// installed apps never prompt for unreleased builds.
//
// capture records pending hashes so artifacts can be deleted before review;
// promote moves pending hashes to live baselines.
//
// capture/update/artifact read baked artifact hashes, not the working tree:
//   iOS: <.ipa|.app|.xcarchive> -> EXUpdates.bundle/fingerprint
//   Android: <.aab|.apk> -> assets/fingerprint
//
// Store builds must bump app.config.js `version`; fingerprints are unordered,
// so apps use semver to distinguish "store is newer" from "server lags me".
// print hashes the APP_VARIANT app; check compares against production
// baselines, so it needs APP_VARIANT=production, which package scripts set.

import { createFingerprintAsync } from "@expo/fingerprint";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = path.join(import.meta.dirname, "..");
const PLATFORMS = ["ios", "android"];
const FINGERPRINT_RE = /^[0-9a-f]{40}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const EXIT_DRIFT = 3;

async function currentHash(platform) {
  const { hash } = await createFingerprintAsync(PROJECT_ROOT, {
    platforms: [platform],
  });
  return hash;
}

/** Live baselines served by the server. */
const FINGERPRINTS_FILE = path.join(
  PROJECT_ROOT,
  "..",
  "..",
  "common",
  "src",
  "mobileFingerprints.gen.ts",
);

/** Pending captures wait for store release; server never imports them. */
const PENDING_FILE = path.join(PROJECT_ROOT, "fingerprint-pending.gen.json");

function fingerprintsFileContents(baselines) {
  const entries = PLATFORMS.map((platform) => {
    const { fingerprint = "", version = "" } = baselines[platform] ?? {};
    return [
      `  ${platform}: {`,
      `    fingerprint: "${fingerprint}",`,
      `    version: "${version}",`,
      `  },`,
    ].join("\n");
  }).join("\n");
  return `// Generated in apps/mobile by \`fingerprint:promote\` / \`fingerprint:update\`;
// do not edit.
// Store-live EAS runtime fingerprints and app versions.
// Apps prompt only when runtimeVersion differs and baseline \`version\` is newer;
// semver is the tiebreak because fingerprints are unordered hashes.
export const MOBILE_STORE_FINGERPRINTS = {
${entries}
} as const;
`;
}

/** Parses generated TS; plain Node cannot import it. */
function readBaselines() {
  if (!fs.existsSync(FINGERPRINTS_FILE)) {
    return Object.fromEntries(PLATFORMS.map((platform) => [platform, null]));
  }
  const source = fs.readFileSync(FINGERPRINTS_FILE, "utf8");
  const baselines = {};
  for (const platform of PLATFORMS) {
    const match = source.match(
      new RegExp(
        `^  ${platform}: \\{\n` +
          `    fingerprint: "([0-9a-f]{40}|)",\n` +
          `    version: "(\\d+\\.\\d+\\.\\d+|)",\n` +
          `  \\},$`,
        "m",
      ),
    );
    if (!match) {
      die(
        `common/src/mobileFingerprints.gen.ts has no parseable "${platform}" entry — it is generated, so restore it from git instead of editing by hand`,
      );
    }
    baselines[platform] = match[1]
      ? { fingerprint: match[1], version: match[2] }
      : null;
  }
  return baselines;
}

function writeBaselines(baselines) {
  fs.writeFileSync(FINGERPRINTS_FILE, fingerprintsFileContents(baselines));
}

function readPending() {
  if (!fs.existsSync(PENDING_FILE)) return {};
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(PENDING_FILE, "utf8"));
  } catch {
    die(
      `could not parse ${path.basename(PENDING_FILE)} as JSON — fix it or delete it and re-run capture`,
    );
  }
  return parsed && typeof parsed === "object" ? parsed : {};
}

function writePending(pending) {
  // Stable key order; no entries means no pending file.
  const ordered = {};
  for (const platform of PLATFORMS) {
    if (pending[platform]) ordered[platform] = pending[platform];
  }
  if (Object.keys(ordered).length === 0) {
    if (fs.existsSync(PENDING_FILE)) fs.rmSync(PENDING_FILE);
    return;
  }
  fs.writeFileSync(PENDING_FILE, `${JSON.stringify(ordered, null, 2)}\n`);
}

/**
 * Reads app.config.js textually instead of parsing artifacts with
 * platform-specific tools; capture/update should run from the release commit.
 */
function readAppVersion() {
  const configPath = path.join(PROJECT_ROOT, "app.config.js");
  const source = fs.readFileSync(configPath, "utf8");
  const match = source.match(/^\s*version: "([^"]+)",$/m);
  if (!match || !SEMVER_RE.test(match[1])) {
    die(
      `could not read a semver \`version: "x.y.z",\` line from app.config.js`,
    );
  }
  return match[1];
}

/** Best-effort capture provenance; git may be unavailable. */
function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function isNewerVersion(a, b) {
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

function ensureVersionBumpedForNewFingerprint(
  platform,
  baseline,
  hash,
  version,
) {
  if (!baseline?.fingerprint || baseline.fingerprint === hash) {
    return;
  }
  if (!baseline.version) {
    die(
      `existing ${platform} baseline has no version; restore common/src/mobileFingerprints.gen.ts from git and rerun`,
    );
  }
  if (isNewerVersion(version, baseline.version)) {
    return;
  }
  die(
    `${platform} fingerprint changed but app.config.js version stayed at ${version}; bump it above the current store baseline (${baseline.version}) before capturing`,
  );
}

function die(message) {
  console.error(`Error: ${message}`);
  // Tool failure; drift uses 3.
  process.exit(2);
}

// --- artifact extraction (capture / update / artifact) ---

function readZipEntry(zipPath, endsWith, label) {
  const entries = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  const entry = entries.find((e) => e.endsWith(endsWith));
  if (!entry) {
    die(
      `no embedded ${label} fingerprint (${endsWith}) inside ${path.basename(zipPath)}`,
    );
  }
  return execFileSync("unzip", ["-p", zipPath, entry], {
    encoding: "utf8",
  }).trim();
}

function readDirEntry(dir, suffix, label) {
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const e of fs.readdirSync(current, { withFileTypes: true })) {
      const p = path.join(current, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (p.endsWith(suffix)) return fs.readFileSync(p, "utf8").trim();
    }
  }
  die(`no ${label} fingerprint (${suffix}) found under ${dir}`);
}

function extractFromArtifact(artifact) {
  if (!artifact) {
    die(
      "usage: node scripts/fingerprint.mjs <capture|update|artifact> <path-to-.ipa|.app|.xcarchive|.aab|.apk>",
    );
  }
  if (!fs.existsSync(artifact)) die(`no such artifact: ${artifact}`);

  const ext = path.extname(artifact).toLowerCase();
  const IOS_SUFFIX = path.join("EXUpdates.bundle", "fingerprint");

  switch (ext) {
    case ".ipa":
      return {
        platform: "ios",
        hash: readZipEntry(artifact, "EXUpdates.bundle/fingerprint", "iOS"),
      };
    case ".app":
    case ".xcarchive":
      return {
        platform: "ios",
        hash: readDirEntry(artifact, IOS_SUFFIX, "iOS"),
      };
    case ".aab":
    case ".apk":
      return {
        platform: "android",
        hash: readZipEntry(artifact, "assets/fingerprint", "Android"),
      };
    default:
      die(
        `unsupported artifact type "${ext}" — expected .ipa/.app/.xcarchive/.aab/.apk`,
      );
  }
}

function fingerprintFromArtifact(artifact) {
  const { platform, hash } = extractFromArtifact(artifact);
  if (!FINGERPRINT_RE.test(hash)) {
    die(`extracted value is not a fingerprint: "${hash}"`);
  }
  return { platform, hash };
}

/** Extracts artifact fingerprint and validates app version bump. */
function buildEntryFromArtifact(artifact) {
  const { platform, hash } = fingerprintFromArtifact(artifact);
  const version = readAppVersion();
  const baselines = readBaselines();
  ensureVersionBumpedForNewFingerprint(
    platform,
    baselines[platform],
    hash,
    version,
  );
  return { platform, hash, version, baselines };
}

// --- commands ---

/** Captures one artifact per platform per release. */
function commandCapture(artifacts) {
  if (!artifacts.length) {
    die(
      "usage: node scripts/fingerprint.mjs capture <path-to-.ipa|.app|.xcarchive|.aab|.apk>...",
    );
  }
  const pending = readPending();
  const captured = [];
  const capturedAt = new Date().toISOString();
  const gitCommit = gitHead();
  for (const artifact of artifacts) {
    const { platform, hash, version } = buildEntryFromArtifact(artifact);
    if (captured.some((c) => c.platform === platform)) {
      die(
        `two artifacts resolved to the same platform (${platform}); pass at most one per platform`,
      );
    }
    const replaced = pending[platform];
    pending[platform] = { fingerprint: hash, version, gitCommit, capturedAt };
    captured.push({ platform, hash, version, replaced });
  }
  writePending(pending);

  for (const { platform, hash, version, replaced } of captured) {
    console.log(`captured ${platform}: ${hash} (version ${version})`);
    if (replaced) {
      console.log(
        `  replaced an earlier pending ${platform} capture (${replaced.fingerprint}, version ${replaced.version})`,
      );
    }
  }
  const many = captured.length > 1;
  console.log(
    `wrote ${path.basename(PENDING_FILE)} — the artifact${many ? "s are" : " is"} no longer needed, you can delete ${many ? "them" : "it"}.`,
  );
  // Omit platform arg when several captures should all promote.
  const promoteArg = many ? "" : ` ${captured[0].platform}`;
  console.log(
    `Commit it, then once ${many ? "these builds are" : "this build is"} LIVE in the store run \`bun run fingerprint:promote${promoteArg}\`.`,
  );
}

function commandPromote(arg) {
  if (arg && !PLATFORMS.includes(arg)) {
    die(`unknown platform "${arg}" — expected one of: ${PLATFORMS.join(", ")}`);
  }
  const pending = readPending();
  const targets = arg ? [arg] : PLATFORMS.filter((p) => pending[p]);
  if (targets.length === 0) {
    die(
      arg
        ? `no pending capture for ${arg} — run \`fingerprint:capture <artifact>\` after building`
        : `nothing pending to promote — run \`fingerprint:capture <artifact>\` after building`,
    );
  }

  const baselines = readBaselines();
  const promoted = [];
  for (const platform of targets) {
    const entry = pending[platform];
    if (!entry) {
      die(
        `no pending capture for ${platform} — run \`fingerprint:capture <artifact>\` after building`,
      );
    }
    // Live baseline may have moved since capture.
    ensureVersionBumpedForNewFingerprint(
      platform,
      baselines[platform],
      entry.fingerprint,
      entry.version,
    );
    baselines[platform] = {
      fingerprint: entry.fingerprint,
      version: entry.version,
    };
    delete pending[platform];
    promoted.push({ platform, entry });
  }
  writeBaselines(baselines);
  writePending(pending);

  for (const { platform, entry } of promoted) {
    const from = entry.gitCommit
      ? ` [commit ${entry.gitCommit.slice(0, 9)}]`
      : "";
    console.log(
      `promoted ${platform}: ${entry.fingerprint} (version ${entry.version})${from}`,
    );
  }
  console.log(
    "wrote common/src/mobileFingerprints.gen.ts — commit and deploy promptly so installed apps learn the new store build.",
  );
}

function commandUpdate(artifact) {
  const { platform, hash, version, baselines } =
    buildEntryFromArtifact(artifact);
  baselines[platform] = { fingerprint: hash, version };
  writeBaselines(baselines);
  // Direct update supersedes pending capture for this platform.
  const pending = readPending();
  if (pending[platform]) {
    delete pending[platform];
    writePending(pending);
  }
  console.log(`${platform}: ${hash} (version ${version})`);
  console.log(
    "wrote common/src/mobileFingerprints.gen.ts — use this only when the build is ALREADY live; otherwise prefer capture + promote.",
  );
}

async function commandCheck() {
  const baselines = readBaselines();
  const pending = readPending();
  const drifted = [];
  for (const platform of PLATFORMS) {
    const current = await currentHash(platform);
    const baseline = baselines[platform]?.fingerprint ?? null;
    if (current === baseline) continue;
    // Pending match means a build exists; otherwise capture is missing or stale.
    const status =
      pending[platform]?.fingerprint === current
        ? "awaiting-promote"
        : "needs-capture";
    drifted.push({ platform, baseline, current, status });
  }

  if (drifted.length === 0) {
    console.log("Mobile fingerprint unchanged — changes are OTA-shippable.");
    return;
  }

  console.log("FINGERPRINT_DRIFT");
  for (const { platform, baseline, current, status } of drifted) {
    console.log(
      `${platform}: ${baseline ?? "(no baseline)"} -> ${current} [${status}]`,
    );
  }
  process.exitCode = EXIT_DRIFT;
}

function commandArtifact(artifact) {
  console.log(fingerprintFromArtifact(artifact).hash);
}

async function commandPrint() {
  for (const platform of PLATFORMS) {
    console.log(`${platform}: ${await currentHash(platform)}`);
  }
}

async function run() {
  const command = process.argv[2] ?? "print";

  switch (command) {
    case "capture":
      return commandCapture(process.argv.slice(3));
    case "promote":
      return commandPromote(process.argv[3]);
    case "update":
      return commandUpdate(process.argv[3]);
    case "artifact":
      return commandArtifact(process.argv[3]);
    case "check":
      return commandCheck();
    case "print":
      return commandPrint();
    default:
      die(
        `unknown command "${command}" — expected one of: print, check, capture, promote, update, artifact`,
      );
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
