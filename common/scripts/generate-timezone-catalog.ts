/**
 * Generates the timezone catalog from a pinned IANA tzdb release.
 *
 * `bump-tzdb.ts` moves both constants below to the latest release. The
 * download is only as trustworthy as the digest that checks it.
 */
import { download, readMember, sha512 } from "./tzdb-archive";

const TZDB_VERSION = "2026d";
const TZDATA_SHA512 =
  "1a27de5af50bbc28a2f64c506ab3678b09d9e5ab6c118f39eb38bb823aa8f57069bf5e465848e71df8274c6b8bcd0fc736a88107e5792d816a1db5d867cbc219";

const ARCHIVE_URL = `https://data.iana.org/time-zones/releases/tzdata${TZDB_VERSION}.tar.gz`;

/**
 * The two UTC zones tzdb keeps out of `zone.tab`. Both resolve to the `UTC`
 * row, as alias names in their own right and as link targets.
 */
const UTC_TARGETS = new Set(["Etc/UTC", "Etc/GMT"]);

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

async function fetchArchive(): Promise<Uint8Array> {
  const bytes = await download(ARCHIVE_URL);

  const digest = sha512(bytes);
  if (digest !== TZDATA_SHA512) {
    throw new Error(`${ARCHIVE_URL} hashes to ${digest}, not ${TZDATA_SHA512}`);
  }

  return bytes;
}

const dataLines = (file: string) =>
  file
    .split("\n")
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter((line) => line !== "");

type CatalogEntry = { tz: string; city: string; country: string | null };

// A locale-aware comparison would reorder the file whenever the generating
// runtime's ICU data changes, so the committed catalog sorts by code unit.
const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const byFirst = ([a]: [string, string], [b]: [string, string]) =>
  byCodeUnit(a, b);

function countryOf(code: string): string {
  const name = regionNames.of(code);
  if (!name || name === code) {
    throw new Error(`no English region name for ${code}`);
  }
  return name;
}

const cityOf = (tz: string) => (tz.split("/").pop() ?? tz).replace(/_/g, " ");

/** Every geographic identifier tzdb offers users to pick from, plus `UTC`. */
function parseZoneTab(zoneTab: string): CatalogEntry[] {
  const zones = dataLines(zoneTab).map((line) => {
    const [code, , tz] = line.split("\t");
    if (!code || !tz) throw new Error(`unreadable zone.tab row: ${line}`);
    return { tz, city: cityOf(tz), country: countryOf(code) };
  });

  return [...zones, { tz: "UTC", city: "UTC", country: null }].sort((a, b) =>
    byCodeUnit(a.tz, b.tz),
  );
}

/**
 * `backzone`'s links, plus its `#PACKRATLIST zone.tab Link` lines, which name
 * the zone each of its full `Zone` entries would otherwise link to.
 */
function parsePlaces(backzone: string): Map<string, string> {
  const places = new Map<string, string>();
  for (const line of backzone.split("\n")) {
    const [keyword, target, name] = line
      .replace(/^#PACKRATLIST zone\.tab /, "")
      .split(/\s+/);
    if (keyword === "Link" && target && name) places.set(name, target);
  }
  return places;
}

/**
 * Links tzdb still resolves, for search and for accepting an old saved value.
 *
 * A link name `zone.tab` also lists is a row in its own right rather than an
 * alias of one. Plenty of listed names are links today, and folding them away
 * would put a Nassau member under Toronto.
 *
 * A link's target is often just a zone with the same clocks since 1970, in
 * another country. So an alias takes, in order, the row its `#= NAME` comment
 * names, the row `backzone` places it in, and only then the link's target.
 * Reading past the first two lands `Iceland` on `Africa/Abidjan` and
 * `Pacific/Yap` on `Pacific/Port_Moresby`.
 */
function parseLinks({
  files,
  rows,
  places,
}: {
  files: readonly string[];
  rows: ReadonlySet<string>;
  places: ReadonlyMap<string, string>;
}): Record<string, string> {
  const aliases: Record<string, string> = Object.fromEntries(
    [...UTC_TARGETS].map((target) => [target, "UTC"]),
  );

  for (const line of files.flatMap((file) => file.split("\n"))) {
    const hash = line.indexOf("#");
    const [fields, comment] =
      hash < 0 ? [line, ""] : [line.slice(0, hash), line.slice(hash)];
    const [keyword, target, name] = fields.trim().split(/\s+/);
    if (keyword !== "Link") continue;
    if (!target || !name) throw new Error(`unreadable link: ${line}`);
    if (rows.has(name)) continue;

    const preferred = comment.match(/^#=\s*(\S+)/)?.[1];
    let place = places.get(name);
    while (place && !rows.has(place)) place = places.get(place);
    const resolved =
      preferred && rows.has(preferred)
        ? preferred
        : (place ?? (UTC_TARGETS.has(target) ? "UTC" : target));
    if (!rows.has(resolved)) {
      throw new Error(`${name} links to ${target}, which is not a catalog row`);
    }
    aliases[name] = resolved;
  }

  return Object.fromEntries(Object.entries(aliases).sort(byFirst));
}

const [destination] = Bun.argv.slice(2);
if (!destination) {
  throw new Error("usage: generate-timezone-catalog.ts <destination>");
}

const archive = await fetchArchive();

const version = (await readMember(archive, "version")).trim();
if (version !== TZDB_VERSION) {
  throw new Error(`archive names itself ${version}, not ${TZDB_VERSION}`);
}

const entries = parseZoneTab(await readMember(archive, "zone.tab"));
const aliases = parseLinks({
  files: [
    await readMember(archive, "backward"),
    await readMember(archive, "etcetera"),
  ],
  rows: new Set(entries.map((entry) => entry.tz)),
  places: parsePlaces(await readMember(archive, "backzone")),
});

const entryLines = entries.map(
  ({ tz, city, country }) =>
    `  { tz: ${JSON.stringify(tz)}, city: ${JSON.stringify(city)}, country: ${JSON.stringify(country)} },`,
);
const aliasLines = Object.entries(aliases).map(
  ([name, target]) => `  [${JSON.stringify(name)}, ${JSON.stringify(target)}],`,
);

await Bun.write(
  destination,
  `// Generated by scripts/generate-timezone-catalog.ts — do not edit by hand.

export const TZDB_VERSION = ${JSON.stringify(TZDB_VERSION)};

export type TimeZoneCatalogEntry = {
  /** IANA identifier. */
  tz: string;
  /** English location name, for a runtime that cannot name the zone itself. */
  city: string;
  /** English country name. Null for \`UTC\`, which belongs to no country. */
  country: string | null;
};

/** Every timezone a member can pick, sorted by identifier. */
export const TIME_ZONE_CATALOG: readonly TimeZoneCatalogEntry[] = [
${entryLines.join("\n")}
];

/** Compatibility identifiers, mapped to the catalog row each one names. */
export const TIME_ZONE_ALIASES: ReadonlyMap<string, string> = new Map([
${aliasLines.join("\n")}
]);
`,
);
