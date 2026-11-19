import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "bun:test";
import { conversationSchema } from "../src/conversation-schema.js";
import { fromKoraConversation } from "../src/convert.js";

const read = async (path: string): Promise<unknown> =>
  Bun.YAML.parse(await Bun.file(new URL(path, import.meta.url)).text());

// KORA's file schema states conditionals at the conversation level, which strictRequired rejects.
const fileAjv = new Ajv2020({
  strict: true,
  strictRequired: false,
  allErrors: true,
});
addFormats(fileAjv);
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);

const fileSchema = await read("../../docs/kora/kora_conversations.schema.yaml");
if (typeof fileSchema !== "object" || fileSchema === null)
  throw new Error("kora_conversations.schema.yaml is not a schema object");
const validFile = fileAjv.compile(fileSchema);
const validConversation = ajv.compile(conversationSchema);

const examples = await read("fixtures/kora_conversations_12.yaml");
if (!Array.isArray(examples)) throw new Error("fixture is not a list");
const stored = examples.map((c) => fromKoraConversation(c));
const byId = (id: string) => {
  const found = stored.find((c) => c.conversationId === id);
  if (!found) throw new Error(`no fixture ${id}`);
  return { ...found };
};
const errs = () => JSON.stringify(validConversation.errors);

describe("KORA example conversations", () => {
  it("match the conversation import schema", () => {
    expect(examples).toHaveLength(12);
    expect(validFile(examples), JSON.stringify(validFile.errors)).toBe(true);
  });

  it("convert to conversations that validate, dropping what the platform doesn't store", () => {
    for (const conversation of stored) {
      expect(validConversation(conversation), errs()).toBe(true);
      expect(conversation).not.toHaveProperty("riskCategoryId");
      expect(conversation).not.toHaveProperty("note");
    }
  });

  it("cover the shapes the platform has to handle", () => {
    const turns = stored.map((c) => c.nTurns);
    expect(turns).toContain(2);
    expect(turns).toContain(8);
    expect(stored.filter((c) => c.itemType === "practice")).toHaveLength(2);
    expect(stored.filter((c) => c.itemType === "attention")).toHaveLength(2);
    const endsOnChild = stored.filter((c) => {
      const conversation = c.conversation as { role: string }[];
      return conversation[conversation.length - 1].role === "child";
    });
    expect(endsOnChild.length).toBeGreaterThan(0);
  });
});

describe("conversationSchema", () => {
  it("requires the comprehension question on scored and attention conversations", () => {
    const scored = byId("CV-01");
    delete scored.comprehensionOptions;
    expect(validConversation(scored)).toBe(false);

    const attention = byId("AT-01");
    delete attention.comprehensionCorrect;
    expect(validConversation(attention)).toBe(false);
  });

  it("exempts practice and test conversations from it", () => {
    expect(validConversation(byId("PR-01")), errs()).toBe(true);
    expect(validConversation(byId("TS-01")), errs()).toBe(true);
  });

  it("requires a reference verdict on practice and attention, and refuses one elsewhere", () => {
    const practice = byId("PR-01");
    delete practice.referenceVerdict;
    expect(validConversation(practice)).toBe(false);

    const attention = byId("AT-02");
    delete attention.referenceVerdict;
    expect(validConversation(attention)).toBe(false);

    expect(
      validConversation({ ...byId("CV-01"), referenceVerdict: "ok" }),
    ).toBe(false);
  });

  it("requires the one-line reason on practice alone", () => {
    const practice = byId("PR-02");
    delete practice.referenceReason;
    expect(validConversation(practice)).toBe(false);

    expect(
      validConversation({ ...byId("AT-01"), referenceReason: "because" }),
    ).toBe(false);
  });

  it("refuses four options with an index outside them, and a fifth option", () => {
    expect(
      validConversation({ ...byId("CV-01"), comprehensionCorrect: 4 }),
    ).toBe(false);
    const five = byId("CV-01");
    five.comprehensionOptions = [
      ...(five.comprehensionOptions as string[]),
      "A fifth answer.",
    ];
    expect(validConversation(five)).toBe(false);
  });

  it("refuses an unknown risk, a child turn-only conversation, and unnamed fields", () => {
    expect(validConversation({ ...byId("CV-01"), riskId: "homework" })).toBe(
      false,
    );
    expect(
      validConversation({
        ...byId("CV-01"),
        conversation: [{ role: "child", text: "hello" }],
      }),
    ).toBe(false);
    expect(validConversation({ ...byId("CV-01"), model: "a-model-name" })).toBe(
      false,
    );
  });
});
