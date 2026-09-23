import {
  TIME_ZONE_ALIASES,
  TIME_ZONE_CATALOG,
} from "@alliance/common/timezone-catalog.gen";
import type { DateTimeFormat } from "@formatjs/intl-datetimeformat";
import { Temporal } from "@js-temporal/polyfill";
import { join } from "node:path";

// The cast holds because the preload installed FormatJS's class.
const { tzData } = Intl.DateTimeFormat as typeof DateTimeFormat;

const NAMES = [
  ...new Set([
    ...TIME_ZONE_CATALOG.map((entry) => entry.tz),
    ...TIME_ZONE_ALIASES.keys(),
    ...Object.keys(tzData),
  ]),
];

// Bun's tzdb predates the rule changes FormatJS carries. Since 2024a, tzdb has
// corrected history only before 2008, so the two agree from then until 2024.
const INSTANTS = [2010, 2016, 2023].flatMap((year) => [
  `${year}-01-15T12:00:00Z`,
  `${year}-07-15T12:00:00Z`,
]);

function offsets(tz: string): string[] {
  return INSTANTS.map(
    (at) => Temporal.Instant.from(at).toZonedDateTimeISO(tz).offset,
  );
}

// Bun preloads FormatJS only from server/, so from the repo root it computes
// with its own ICU.
const REFERENCE_SCRIPT = `
const { Temporal } = require("@js-temporal/polyfill");
const { names, instants } = JSON.parse(require("fs").readFileSync(0, "utf8"));
const offsets = {};
for (const tz of names) {
  try {
    offsets[tz] = instants.map((at) => Temporal.Instant.from(at).toZonedDateTimeISO(tz).offset);
  } catch {}
}
console.log(JSON.stringify({ polyfilled: "polyfilled" in Intl.DateTimeFormat, offsets }));
`;

function bunReference(): {
  polyfilled: boolean;
  offsets: Record<string, string[]>;
} {
  const child = Bun.spawnSync([process.execPath, "-e", REFERENCE_SCRIPT], {
    cwd: join(__dirname, "../.."),
    stdin: Buffer.from(JSON.stringify({ names: NAMES, instants: INSTANTS })),
  });
  if (!child.success) throw new Error(child.stderr.toString());
  return JSON.parse(child.stdout.toString());
}

describe("server timezone data", () => {
  const reference = bunReference();

  it("compares against Bun's own tzdb", () => {
    expect(reference.polyfilled).toBe(false);
    expect(reference.offsets.UTC).toBeDefined();
  });

  // A name Bun's tzdb lacks, like America/Coyhaique on Linux, only has to
  // compute.
  it.each(NAMES)("computes %p as Bun did", (tz) => {
    const actual = offsets(tz);
    const expected = reference.offsets[tz];
    if (expected) expect(actual).toEqual(expected);
  });

  // Bun's ICU has neither rule, so these fail if Temporal isn't reading
  // FormatJS's tzdb.
  it.each([
    {
      release: "2025b",
      tz: "America/Coyhaique",
      at: "2026-07-01T12:00:00Z",
      offset: "-03:00",
    },
    {
      release: "2026d",
      tz: "America/Inuvik",
      at: "2027-01-15T12:00:00Z",
      offset: "-06:00",
    },
  ])("applies the $release rule for $tz", ({ tz, at, offset }) => {
    expect(Temporal.Instant.from(at).toZonedDateTimeISO(tz).offset).toBe(
      offset,
    );
  });

  it("keeps Date's local time zone the same as Intl's", () => {
    expect(Temporal.Now.timeZoneId()).toBe("UTC");
    expect(new Date(0).getTimezoneOffset()).toBe(0);
  });
});
