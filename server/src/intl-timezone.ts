import { R } from "@alliance/common/result";
import { TIME_ZONE_ALIASES } from "@alliance/common/timezone-catalog.gen";
import type { DateTimeFormat } from "@formatjs/intl-datetimeformat";

// Temporal reads zone rules from Intl.DateTimeFormat, and Bun's ICU is only as
// current as the Bun release. FormatJS ships its own tzdb, updated through npm.
import "@formatjs/intl-datetimeformat/polyfill-force.js";

// The tz data registers only with the polyfill above already installed, and is
// silently dropped otherwise. The blank line keeps the import sorter from
// moving these above it.
import "@formatjs/intl-datetimeformat/add-all-tz.js";
import "@formatjs/intl-datetimeformat/locale-data/en.js";

// FormatJS takes UTC as the local zone whatever the host says, so Date does too.
process.env.TZ = "UTC";

// FormatJS misreads tzdb's link files and throws on some catalog aliases, such
// as GMT. Each takes the rules of the row it names. A name with no rules, like
// UTC, computes at +00:00. The cast holds because polyfill-force installed
// FormatJS's class as Intl.DateTimeFormat.
const { tzData } = Intl.DateTimeFormat as typeof DateTimeFormat;
for (const [alias, row] of TIME_ZONE_ALIASES) {
  const known = R.fromThrowable(
    () => new Intl.DateTimeFormat(undefined, { timeZone: alias }),
  );
  if (R.isFailure(known)) tzData[alias] = tzData[row];
}
