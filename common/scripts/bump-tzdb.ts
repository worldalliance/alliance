/**
 * Points the catalog generator at the latest tzdb release. Prints the new
 * version when it moves, and nothing when the generator is already current.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { download, readMember, sha512 } from "./tzdb-archive";

const LATEST_URL = "https://data.iana.org/time-zones/tzdata-latest.tar.gz";
// Paul Eggert's release key, 7E37 92A9 D8AC F7D6 33BC 1588 ED97 E90E 62AA 7E34.
const SIGNING_KEYRING = `${import.meta.dir}/tzdb-signing-key.gpg`;
const GENERATOR = `${import.meta.dir}/generate-timezone-catalog.ts`;
const VERSION_LINE = /^const TZDB_VERSION = "(\w+)";$/m;
const DIGEST_LINE = /^(const TZDATA_SHA512 =\s+)"[0-9a-f]{128}";$/m;

const source = await Bun.file(GENERATOR).text();
const current = source.match(VERSION_LINE)?.[1];
if (!current || !DIGEST_LINE.test(source)) {
  throw new Error(
    `${GENERATOR} no longer declares its release the way this script expects`,
  );
}

async function verifySignature(archive: Uint8Array): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "tzdb-"));
  try {
    const signature = join(dir, "tzdata.tar.gz.asc");
    await Bun.write(signature, await download(`${LATEST_URL}.asc`));
    const gpgv = Bun.spawn(
      ["gpgv", "--keyring", SIGNING_KEYRING, signature, "-"],
      { stdin: archive, stderr: "inherit" },
    );
    if ((await gpgv.exited) !== 0) {
      throw new Error(
        `${LATEST_URL} does not carry the tzdb release signature`,
      );
    }
  } finally {
    await rm(dir, { recursive: true });
  }
}

const archive = await download(LATEST_URL);
await verifySignature(archive);
const latest = (await readMember(archive, "version")).trim();
if (!/^\d{4}[a-z]+$/.test(latest)) {
  throw new Error(`the latest archive names itself ${JSON.stringify(latest)}`);
}

if (latest < current) {
  throw new Error(`the latest archive is ${latest}, older than ${current}`);
}
if (latest > current) {
  await Bun.write(
    GENERATOR,
    source
      .replace(VERSION_LINE, `const TZDB_VERSION = "${latest}";`)
      .replace(DIGEST_LINE, `$1"${sha512(archive)}";`),
  );
  console.log(latest);
}
