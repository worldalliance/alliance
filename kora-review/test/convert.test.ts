import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "bun:test";
import sample from "../samples/transcript.json";
import { fromKoraPair, readKoraPairs } from "../src/convert.js";
import { parseKoraExport, parseKoraTranscript } from "../src/parse.js";
import { SAMPLE_EXPORT } from "../src/sample-export.js";
import { transcriptSchema } from "../src/schemas.js";

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validTranscript = ajv.compile(transcriptSchema);

const nativeOf = (t: typeof sample, id = t.transcriptId) => ({
  pair_id: id,
  risk_id: t.category,
  risk_category_id: "dropped",
  pair_type: t.pairType,
  scenario_title: t.scenarioTitle,
  child_age: t.childAge,
  age_band: t.ageBand,
  child_background: t.childBackground,
  scenario: t.scenario,
  conversation_a: t.conversationA.map((turn) => ({
    ...turn,
    model: "dropped",
  })),
  conversation_b: t.conversationB,
  feedback_text: "dropped",
});

describe("readKoraPairs", () => {
  it("numbers JSON Lines from 1, skipping blank lines, and reports a bad line without stopping", () => {
    const text = [
      JSON.stringify(nativeOf(sample, "P1")),
      "",
      "{not json",
      JSON.stringify(nativeOf(sample, "P2")),
    ].join("\n");
    const records = readKoraPairs(text);
    expect(records.map((r) => [r.line, r.ok])).toEqual([
      [1, true],
      [3, false],
      [4, true],
    ]);
  });

  it("reads a JSON array, whole or split one element per line", () => {
    const pairs = [nativeOf(sample, "P1"), nativeOf(sample, "P2")];
    expect(readKoraPairs(JSON.stringify(pairs)).map((r) => r.line)).toEqual([
      1, 2,
    ]);
    const split = [
      "[",
      ...pairs.map(
        (p, i) => JSON.stringify(p) + (i < pairs.length - 1 ? "," : ""),
      ),
      "]",
    ].join("\n");
    expect(readKoraPairs(split).filter((r) => r.ok).length).toBe(2);
  });

  it("reads a YAML list, numbering each pair by the line it starts on", () => {
    const yaml = [
      "# KORA pairs",
      "- pair_id: P1",
      "  risk_id: cybersecurity",
      "",
      "- pair_id: P2",
      "  risk_id: cybersecurity",
    ].join("\n");
    expect(readKoraPairs(yaml)).toEqual([
      {
        line: 2,
        ok: true,
        record: { pair_id: "P1", risk_id: "cybersecurity" },
      },
      {
        line: 5,
        ok: true,
        record: { pair_id: "P2", risk_id: "cybersecurity" },
      },
    ]);
  });

  it("reports a YAML syntax error at its line, and refuses YAML that isn't a list", () => {
    expect(readKoraPairs("- pair_id: P1\n- pair_id: [P2\n")).toMatchObject([
      { line: 3, ok: false },
    ]);
    expect(readKoraPairs("pair_id: P1")).toEqual([
      { line: 1, ok: false, error: "a YAML file must be a list of pairs" },
    ]);
    expect(readKoraPairs("# nothing yet\n")).toEqual([]);
  });
});

describe("fromKoraPair", () => {
  it("converts a KORA pair into a transcript that validates, dropping fields the schema doesn't name", () => {
    const converted = fromKoraPair(nativeOf(sample));
    expect(validTranscript(converted)).toBe(true);
    expect(converted).toEqual(sample);
  });

  it("produces a transcript that fails validation from a record that isn't a pair", () => {
    expect(validTranscript(fromKoraPair("text"))).toBe(false);
    expect(
      validTranscript(
        fromKoraPair({ ...nativeOf(sample), risk_id: "not_a_category" }),
      ),
    ).toBe(false);
  });
});

describe("parseKoraTranscript", () => {
  it("returns a stored transcript and refuses one with an unknown category", () => {
    expect<unknown>(parseKoraTranscript(sample)).toEqual(sample);
    expect(() =>
      parseKoraTranscript({ ...sample, category: "nope" }),
    ).toThrow();
  });
});

describe("parseKoraExport", () => {
  it("returns a stored export and refuses one from another schema version", () => {
    expect<unknown>(parseKoraExport(SAMPLE_EXPORT)).toEqual(SAMPLE_EXPORT);
    expect(() =>
      parseKoraExport({ ...SAMPLE_EXPORT, schemaVersion: 1 }),
    ).toThrow();
  });
});
