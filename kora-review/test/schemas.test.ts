import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import sampleTranscript from "../samples/transcript.json";
import samplePairs from "../samples/transcripts.json";
import {
  exportSchema,
  SCHEMA_VERSION,
  transcriptSchema,
} from "../src/index.js";
import { SAMPLE_EXPORT as sampleExport } from "../src/sample-export.js";

// The same setup a host would use: ajv's draft 2020-12 build, strict mode on, with date-time formats.
function compile() {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  return {
    transcript: ajv.compile(transcriptSchema),
    exported: ajv.compile(exportSchema),
  };
}
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe("schemas", () => {
  const v = compile();

  it("compile under ajv strict mode", () => {
    expect(typeof v.transcript).toBe("function");
    expect(typeof v.exported).toBe("function");
  });

  it("accept the sample transcript and every sample pair", () => {
    expect(
      v.transcript(sampleTranscript),
      JSON.stringify(v.transcript.errors),
    ).toBe(true);
    for (const t of samplePairs)
      expect(v.transcript(t), JSON.stringify(v.transcript.errors)).toBe(true);
  });

  it("accept the sample export, which holds a partly answered pending result", () => {
    expect(v.exported(sampleExport), JSON.stringify(v.exported.errors)).toBe(
      true,
    );
    const pending = sampleExport.results.find(
      (r) => r.status === "pending" && "q0_a" in r,
    );
    expect(pending).toBeTruthy();
    expect(pending).not.toHaveProperty("q1");
  });

  it("reject fields the schema doesn't name, at every level", () => {
    const t = clone(sampleTranscript) as Record<string, unknown>;
    t.email = "someone@example.org";
    expect(v.transcript(t)).toBe(false);

    const turn = clone(sampleTranscript);
    (turn.conversationA[0] as Record<string, unknown>).name = "Ana";
    expect(v.transcript(turn)).toBe(false);

    const e1 = clone(sampleExport);
    (e1.reviewer as Record<string, unknown>).email = "someone@example.org";
    expect(v.exported(e1)).toBe(false);

    const e2 = clone(sampleExport);
    (e2.results[0] as Record<string, unknown>).reviewer = { name: "Ana" };
    expect(v.exported(e2)).toBe(false);

    const e3 = clone(sampleExport);
    (e3.results[1].annotations[0] as Record<string, unknown>).phone = "555";
    expect(v.exported(e3)).toBe(false);

    const e4 = clone(sampleExport);
    (e4.profile as Record<string, unknown>).name = "Ana";
    expect(v.exported(e4)).toBe(false);
  });

  it("require every answer on a done result", () => {
    const e = clone(sampleExport);
    delete (e.results[1] as Record<string, unknown>).q1;
    delete (e.results[1] as Record<string, unknown>).failingSide;
    expect(v.exported(e)).toBe(false);
  });

  it("reject an unknown category and a malformed contentHash", () => {
    expect(
      v.transcript({ ...clone(sampleTranscript), category: "homework-help" }),
    ).toBe(false);
    const e = clone(sampleExport);
    e.results[0].contentHash = "abc";
    expect(v.exported(e)).toBe(false);
  });

  it("are the version the sample export carries", () => {
    expect(sampleExport.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("have generated types that match the schemas", () => {
    expect(() =>
      execFileSync(process.execPath, ["scripts/gen-types.mjs", "--check"], {
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
});
