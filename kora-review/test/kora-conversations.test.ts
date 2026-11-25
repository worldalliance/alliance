import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "bun:test";
import { fromKoraConversation } from "../src/convert.js";
import { transcriptSchema } from "../src/index.js";

const read = async (path: string): Promise<unknown> =>
  Bun.YAML.parse(await Bun.file(new URL(path, import.meta.url)).text());

// KORA's conditionals require fields declared at the item level, which strictRequired rejects, and bound child_age
// without restating its type, which strictTypes rejects; both are fixed in the schema's generator, not here.
const ajv = new Ajv2020({
  strict: true,
  strictRequired: false,
  strictTypes: false,
  allErrors: true,
});
addFormats(ajv);
const conversationSchema = await read(
  "../../docs/kora/kora_conversations.schema.yaml",
);
if (typeof conversationSchema !== "object" || conversationSchema === null)
  throw new Error("kora_conversations.schema.yaml is not a schema object");
const validConversations = ajv.compile(conversationSchema);
const validTranscript = ajv.compile(transcriptSchema);
const examples = await read("fixtures/kora_examples_20.yaml");
if (!Array.isArray(examples)) throw new Error("fixture is not a list");

describe("KORA example conversations", () => {
  it("match the conversation import schema", () => {
    expect(examples).toHaveLength(20);
    expect(
      validConversations(examples),
      JSON.stringify(validConversations.errors),
    ).toBe(true);
  });

  it("convert to valid transcripts", () => {
    for (const item of examples) {
      const t = fromKoraConversation(item);
      expect(validTranscript(t), JSON.stringify(validTranscript.errors)).toBe(
        true,
      );
    }
  });
});
