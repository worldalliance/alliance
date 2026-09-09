// Compiles global.css the way metro does, pairing the `@tailwindcss/node`
// uniwind bundles with the `tailwindcss` the workspace hoists. Those two
// resolve separately, so a release that moves one past the other breaks the
// mobile build and nothing else.

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const projectRoot = path.join(import.meta.dirname, "..");
const metroConfig = require(path.join(projectRoot, "metro.config.js"));
const { uniwind } = metroConfig.transformer;
const cssPath = path.join(projectRoot, uniwind.cssEntryFile);

// uniwind's `exports` names no subpath for any of these, and the transformer
// that wraps them wants a metro worker, so they come in by file path.
const uniwindRoot = path.dirname(require.resolve("uniwind/package.json"));
const { Logger } = await import(path.join(uniwindRoot, "src/metro/logger.ts"));
const { injectThemes } = await import(
  path.join(uniwindRoot, "src/metro/injectThemes.ts")
);
const { compileVirtual } = await import(
  path.join(uniwindRoot, "src/metro/compileVirtual.ts")
);

// uniwind raises nothing on a style it cannot handle. It logs an error and
// skips the style, or a warning and keeps a mangled value, so both come off
// stdout. The two accepted warnings are uniwind refusing to serialize a list
// marker.
const acceptedLogs = [
  'Unsupported value type - "counter-style" for className list-decimal',
  'Unsupported value type - "counter-style" for className list-disc',
];

const probe = "check-css log pipe probe";
const unexpectedLogs = [];
let seenProbe = false;
const log = console.log;

console.log = (...args) => {
  const line = args.join(" ");

  if (/Uniwind (Error|Warning)/.test(line)) {
    if (line.includes(probe)) {
      seenProbe = true;
    } else if (!acceptedLogs.some((accepted) => line.includes(accepted))) {
      unexpectedLogs.push(line);
    }
  }

  log(...args);
};

// `debug` is what ungates the warnings, and they carry the drift. An unknown
// unit warns and hands back the bare number, so `--text-base: 17cqw` compiles
// to 17 and every assertion below it passes. Warning through uniwind's own
// logger is what proves this can still read them, because a release moving the
// logging off stdout would otherwise leave the check reading nothing and
// passing green on the drift it exists to catch.
Logger.debug = true;
Logger.warn(probe);

// `global.css` imports `uniwind`, and this writes the file behind that import,
// off the themes and the `@variant` blocks the CSS declares.
await injectThemes({
  input: cssPath,
  themes: uniwind.themes,
  dtsPath: path.join(projectRoot, uniwind.dtsFile),
});

const compiled = await compileVirtual({
  css: fs.readFileSync(cssPath, "utf8"),
  cssPath,
  platform: "ios",
  themes: uniwind.themes,
  polyfills: uniwind.polyfills,
  debug: true,
});

// The compile hands back the source of the module metro loads, so evaluating it
// reads the stylesheet metro would rather than the text of it. `rt` is uniwind's
// runtime, which the serialized vars read for the color scheme.
const { stylesheet, vars } = new Function("rt", `return ${compiled}`)({
  colorScheme: "light",
});

// A candidate Tailwind stops recognizing is dropped rather than raised, so the
// compile returning says nothing on its own. Resolving the entry is what catches
// a release moving a utility onto a variable nothing defines, which answers NaN
// and compiles clean.
const utilities = [
  { className: "text-base", property: "fontSize" },
  { className: "leading-normal", property: "lineHeight" },
];

const problems = [...unexpectedLogs];

if (!seenProbe) {
  problems.push("uniwind's logs no longer reach this check");
}

for (const { className, property } of utilities) {
  const entry = (stylesheet[className]?.[0]?.entries ?? []).find(
    ([name]) => name === property,
  );

  if (entry === undefined) {
    problems.push(`${className} compiled without ${property}`);
    continue;
  }

  const [, readValue] = entry;
  const value = readValue.call(vars);

  if (!Number.isFinite(value)) {
    problems.push(`${className} resolves ${property} to ${value}`);
  }
}

if (problems.length > 0) {
  throw new Error(
    [
      "global.css did not compile clean:",
      ...problems.map((problem) => `  ${problem}`),
      "",
      "A warning naming a class means React Native cannot render it. Stop using",
      "the class, or add the warning to `acceptedLogs` in this file once you know",
      "why it is harmless. Anything else is the two Tailwinds drifting apart,",
      "which `skills/uniwind-pin` walks through.",
    ].join("\n"),
  );
}

console.log("global.css compiles.");
