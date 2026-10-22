import { findNewRepeatedCopy } from "./repeated-copy";

const SENTENCE = "Couldn't load the people you can message.";

const scan = (
  current: Record<string, string>,
  base: Record<string, string> = {},
) =>
  findNewRepeatedCopy({
    current: new Map(Object.entries(current)),
    base: new Map(Object.entries(base)),
  });

test("reports a sentence copied into a second file", () => {
  const a = `export const a = "${SENTENCE}";\n`;
  expect(scan({ "a.ts": a, "b.ts": a }, { "a.ts": a })).toEqual([
    {
      text: SENTENCE,
      occurrences: [
        { file: "a.ts", line: 1 },
        { file: "b.ts", line: 1 },
      ],
    },
  ]);
});

test("reports a repeat within one file", () => {
  const twice = `const a = "${SENTENCE}";\nconst b = "${SENTENCE}";\n`;
  expect(scan({ "a.ts": twice })).toHaveLength(1);
});

test("reports the fixed text of an interpolated template", () => {
  const message = "Capacity cannot be less than the current number of members";
  const twice = `const a = \`${message} (\${n}).\`;\nconst b = \`${message} (\${n}).\`;\n`;
  expect(scan({ "a.ts": twice })).toHaveLength(1);
});

test("skips a repeat the base already has", () => {
  const files = {
    "a.ts": `const a = "${SENTENCE}";\n`,
    "b.ts": `const b = "${SENTENCE}";\n`,
  };
  expect(scan(files, files)).toEqual([]);
});

test("reports another copy of a sentence the base already repeats", () => {
  const base = {
    "a.ts": `const a = "${SENTENCE}";\n`,
    "b.ts": `const b = "${SENTENCE}";\n`,
  };
  expect(scan({ ...base, "c.ts": `const c = "${SENTENCE}";\n` }, base)).toEqual(
    [expect.objectContaining({ text: SENTENCE })],
  );
});

test("skips text under five words", () => {
  const a = `const a = "Save your changes";\n`;
  expect(scan({ "a.ts": a, "b.ts": a })).toEqual([]);
});

test("matches JSX text against a string literal across entity and quote styles", () => {
  expect(
    scan({
      "a.tsx": `const A = () => <p>Couldn&apos;t load the people you can message.</p>;\n`,
      "b.ts": `const b = "Couldn’t load the people you can message.";\n`,
    }),
  ).toHaveLength(1);
});

test("decodes named entities and non-breaking spaces", () => {
  expect(
    scan({
      "a.tsx": `const A = () => <p>You&rsquo;ll get an&nbsp;email when it&rsquo;s &ldquo;ready&rdquo;.</p>;\n`,
      "b.ts": `const b = 'You\\'ll get an email when it\\'s "ready".';\n`,
    }),
  ).toHaveLength(1);
});

test("skips styling strings", () => {
  const classes = "w-full border border-gray-300 rounded focus:ring-1";
  expect(
    scan({
      "a.tsx": `const A = () => <div className="flex items-center gap-2 px-3 py-2" />;\n`,
      "b.tsx": `const B = () => <div className="flex items-center gap-2 px-3 py-2" />;\n`,
      "c.ts": `const c = cn("text-sm font-medium text-gray-700 mb-1 block");\n`,
      "d.ts": `const d = cn("text-sm font-medium text-gray-700 mb-1 block");\n`,
      "e.ts": `const inputBase = "${classes}";\n`,
      "f.ts": `const inputBase = "${classes}";\n`,
      "g.ts": `const g = "bg-gray-4 text-white hover:bg-[#444] border border-[#444]";\n`,
      "h.ts": `const h = "bg-gray-4 text-white hover:bg-[#444] border border-[#444]";\n`,
      "i.tsx": `const I = () => <div style={{ boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)" }} />;\n`,
      "j.tsx": `const J = () => <div style={{ boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)" }} />;\n`,
    }),
  ).toEqual([]);
});

test("counts the same text on two attributes of one element once", () => {
  const label = "New project for this action";
  expect(
    scan({
      "a.tsx": `const A = () => <button aria-label="${label}" title="${label}" />;\n`,
    }),
  ).toEqual([]);
});

test("counts the same text in two attribute expressions of one element once", () => {
  expect(
    scan({
      "a.tsx": `const A = ({ open }: { open: boolean }) => <button aria-label={open ? "${SENTENCE}" : "x"} title={open ? "${SENTENCE}" : "x"} />;\n`,
    }),
  ).toEqual([]);
});

test("reports the same text twice inside one function-valued attribute", () => {
  expect(
    scan({
      "a.tsx": `const A = () => <L onPress={() => { toast("${SENTENCE}"); log("${SENTENCE}"); }} />;\n`,
    }),
  ).toHaveLength(1);
});

test("still reports the same text on two different elements", () => {
  expect(
    scan({
      "a.tsx": `const A = () => <>\n  <button title="${SENTENCE}" />\n  <button title="${SENTENCE}" />\n</>;\n`,
    }),
  ).toHaveLength(1);
});

test("skips lines inside jscpd ignore comments", () => {
  expect(
    scan({
      "a.ts": `const a = "${SENTENCE}";\n`,
      "b.ts": `// jscpd:ignore-start\nconst b = "${SENTENCE}";\n// jscpd:ignore-end\n`,
    }),
  ).toEqual([]);
});

test("skips a renamed file whose text the base already repeated", () => {
  const a = `const a = "${SENTENCE}";\n`;
  const b = `const b = "${SENTENCE}";\n`;
  expect(
    scan({ "renamed.ts": a, "b.ts": b }, { "a.ts": a, "b.ts": b }),
  ).toEqual([]);
});

test("treats only comment markers as ignore regions", () => {
  expect(
    scan({
      "a.ts": `/** Lines in \`jscpd:ignore-start\` blocks are skipped. */\nconst a = "${SENTENCE}";\n`,
      "b.ts": `const b = "${SENTENCE}";\n`,
    }),
  ).toHaveLength(1);
});

test("honors ignore comments inside JSX", () => {
  expect(
    scan({
      "a.tsx": `const A = () => (\n  <>\n    {/* jscpd:ignore-start */}\n    <p>${SENTENCE}</p>\n    {/* jscpd:ignore-end */}\n  </>\n);\n`,
      "b.ts": `const b = "${SENTENCE}";\n`,
    }),
  ).toEqual([]);
});
