import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "bun:test";
import { fromKoraPair } from "../src/convert.js";
import { KoraCategory, transcriptSchema } from "../src/index.js";

const read = async (path: string): Promise<unknown> =>
  Bun.YAML.parse(await Bun.file(new URL(path, import.meta.url)).text());

// KORA's conditionals require fields declared at the pair level, which strictRequired rejects.
const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
addFormats(ajv);
const pairSchema = await read("../../docs/kora/kora_pairs.schema.yaml");
if (typeof pairSchema !== "object" || pairSchema === null)
  throw new Error("kora_pairs.schema.yaml is not a schema object");
const validPairs = ajv.compile(pairSchema);
const validTranscript = ajv.compile(transcriptSchema);
const examples = await read("fixtures/kora_examples_20.yaml");
if (!Array.isArray(examples)) throw new Error("fixture is not a list");

describe("KORA example pairs", () => {
  it("match the pair import schema", () => {
    expect(examples).toHaveLength(20);
    expect(validPairs(examples), JSON.stringify(validPairs.errors)).toBe(true);
  });

  it("convert to valid transcripts where the tool knows the risk", () => {
    const known = new Set<unknown>(Object.values(KoraCategory));
    // The tool serves 10 of the 26 risks; examples on the others wait for that list to grow.
    const served = examples.filter((p) => known.has(p.risk_id));
    expect(served.length).toBeGreaterThan(0);
    for (const pair of served) {
      const t = fromKoraPair(pair);
      expect(validTranscript(t), JSON.stringify(validTranscript.errors)).toBe(
        true,
      );
    }
  });
});
