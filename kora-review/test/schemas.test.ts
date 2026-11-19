import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { conversationSchema } from "../src/conversation-schema.js";
import { exportSchema, itemSchema, SCHEMA_VERSION } from "../src/index.js";
import { SAMPLE_EXPORT, SAMPLE_ITEMS } from "../src/sample-export.js";

// The same setup a host would use: ajv's draft 2020-12 build, strict mode on, with date-time formats.
function compile() {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  return {
    conversation: ajv.compile(conversationSchema),
    item: ajv.compile(itemSchema),
    exported: ajv.compile(exportSchema),
  };
}
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe("schemas", () => {
  const v = compile();
  const errs = () => JSON.stringify(v.exported.errors);

  it("compile under ajv strict mode", () => {
    expect(typeof v.conversation).toBe("function");
    expect(typeof v.item).toBe("function");
    expect(typeof v.exported).toBe("function");
  });

  it("accept the sample items and the sample session", () => {
    for (const item of SAMPLE_ITEMS)
      expect(v.item(item), JSON.stringify(v.item.errors)).toBe(true);
    expect(v.exported(SAMPLE_EXPORT), errs()).toBe(true);
  });

  it("are the version the sample export carries", () => {
    expect(SAMPLE_EXPORT.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("reject fields the schema doesn't name, at every level", () => {
    const item = clone(SAMPLE_ITEMS[1]);
    expect(v.item({ ...item, model: "a-model-name" })).toBe(false);
    expect(v.item({ ...item, comprehensionCorrect: 0 })).toBe(false);

    const e1 = clone(SAMPLE_EXPORT);
    Object.assign(e1.reviewer, { email: "someone@example.org" });
    expect(v.exported(e1)).toBe(false);

    const e2 = clone(SAMPLE_EXPORT);
    Object.assign(e2.ratings[0], { reviewer: { name: "Ana" } });
    expect(v.exported(e2)).toBe(false);

    const e3 = clone(SAMPLE_EXPORT);
    Object.assign(e3.ratings[1].highlights[0], { phone: "555" });
    expect(v.exported(e3)).toBe(false);
  });

  it("require every answer on a finished rating", () => {
    const e = clone(SAMPLE_EXPORT);
    delete (e.ratings[0] as Partial<(typeof e.ratings)[0]>).q1;
    expect(v.exported(e)).toBe(false);

    const rated = clone(SAMPLE_EXPORT);
    rated.ratings[1].status = "done";
    rated.ratings[1].completedAt = "2026-11-17T18:12:00.000Z";
    rated.ratings[1].q1 = "ok";
    rated.ratings[1].q2Confidence = 2;
    expect(v.exported(rated), errs()).toBe(true);

    delete (rated.ratings[1] as Partial<(typeof rated.ratings)[0]>)
      .comprehensionAnswer;
    expect(v.exported(rated)).toBe(false);
  });

  it("tie severity and the worry to a Not OK verdict", () => {
    const e = clone(SAMPLE_EXPORT);
    e.ratings[0].q3Severity = 3;
    expect(v.exported(e)).toBe(false);

    const notOk = clone(SAMPLE_EXPORT);
    notOk.ratings[0].q1 = "not_ok";
    expect(v.exported(notOk)).toBe(false);
    notOk.ratings[0].q3Severity = 2;
    notOk.ratings[0].q4Text = "It keeps a secret from the child's mother.";
    expect(v.exported(notOk), errs()).toBe(true);
  });

  it("offer each highlight reason only with the valence it belongs to", () => {
    const e = clone(SAMPLE_EXPORT);
    e.ratings[1].highlights[0].reason = "unsafe_advice";
    expect(v.exported(e)).toBe(false);

    const dislike = clone(SAMPLE_EXPORT);
    dislike.ratings[1].highlights[0].valence = "dislike";
    dislike.ratings[1].highlights[0].reason = "unsafe_advice";
    expect(v.exported(dislike), errs()).toBe(true);
  });

  it("reject an unknown risk and a malformed contentHash", () => {
    expect(v.item({ ...clone(SAMPLE_ITEMS[1]), riskId: "homework-help" })).toBe(
      false,
    );
    const e = clone(SAMPLE_EXPORT);
    e.ratings[0].contentHash = "abc";
    expect(v.exported(e)).toBe(false);
  });

  it("have generated types that match the schemas", () => {
    expect(() =>
      execFileSync(process.execPath, ["scripts/gen-types.mjs", "--check"], {
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
});
