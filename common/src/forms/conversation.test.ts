import {
  conversationNote,
  fieldAnswerKeys,
  stripOrphanedNotes,
  withConversationNoteFields,
} from "./conversation";
import type { ExpertMessageBlock } from "./display-blocks";
import { displayOnlyMarkdown } from "./display-only-markdown";
import type { ConversationField, FormSchema } from "./form-schema";
import { validateFormSchema } from "./form-schema-validate";
import { stripHiddenAnswers } from "./visibility";

const conversation = (
  overrides: Partial<ConversationField> = {},
): ConversationField => ({
  id: "aware",
  type: "input",
  kind: "conversation",
  label: "Aware of statements",
  expert: { userId: 7, userName: "Dr Maria" },
  message: "Were you aware of these statements?",
  options: [
    { label: "Yes, and I accept them", value: "accept" },
    {
      label: "Yes, but I am not convinced",
      value: "skeptic",
      reply: "Please leave a note about your skepticism",
      note: { required: true },
    },
    { label: "No", value: "unaware", reply: "Thank you for your reply" },
  ],
  noteId: "aware_note",
  ...overrides,
});

const schema = (...fields: FormSchema["pages"][number]["fields"]) =>
  ({ pages: [{ id: "p1", fields }], outputViews: [] }) satisfies FormSchema;

describe("conversationNote", () => {
  it("is the chosen option's note box, or none", () => {
    expect(conversationNote(conversation(), { aware: "skeptic" })).toEqual({
      required: true,
    });
    expect(conversationNote(conversation(), { aware: "unaware" })).toBe(
      undefined,
    );
    expect(conversationNote(conversation(), {})).toBe(undefined);
  });
});

describe("fieldAnswerKeys", () => {
  it("adds a conversation's note id", () => {
    expect(fieldAnswerKeys(conversation())).toEqual(["aware", "aware_note"]);
  });
});

describe("stripOrphanedNotes", () => {
  it("drops a note once the chosen option shows no note box", () => {
    const answers = { aware: "unaware", aware_note: "left over" };
    expect(stripOrphanedNotes([conversation()], answers)).toEqual({
      aware: "unaware",
    });
  });

  it("keeps a note the chosen option asks for", () => {
    const answers = { aware: "skeptic", aware_note: "why" };
    expect(stripOrphanedNotes([conversation()], answers)).toBe(answers);
  });
});

describe("stripHiddenAnswers", () => {
  it("strips a hidden conversation's note with its choice", () => {
    const hidden = conversation({
      visibleIfFormula: {
        conditions: { c1: { kind: "equals", when: "gate", equals: "show" } },
        formula: "c1",
      },
    });
    const answers = { aware: "skeptic", aware_note: "why" };
    expect(
      stripHiddenAnswers(schema(hidden).pages, answers, {
        deviceType: "desktop",
      }),
    ).toEqual({});
  });
});

describe("withConversationNoteFields", () => {
  it("follows each conversation with its note as a text field", () => {
    const [choice, note] = withConversationNoteFields([conversation()]);
    expect(choice?.id).toBe("aware");
    expect(note).toMatchObject({
      id: "aware_note",
      kind: "textarea",
      label: "Aware of statements: note",
    });
  });
});

describe("validateFormSchema on a conversation", () => {
  const messages = (...fields: ConversationField[]) =>
    validateFormSchema(schema(...fields)).map((error) => error.message);

  it("accepts a complete conversation", () => {
    expect(messages(conversation())).toEqual([]);
  });

  it("refuses one with no expert, message or second option", () => {
    expect(
      messages(
        conversation({
          expert: null,
          message: " ",
          options: [{ label: "Only", value: "only" }],
        }),
      ),
    ).toEqual([
      "Conversation has no expert. Pick one",
      "Conversation has no message. Write what the expert asks",
      "Conversation needs at least two options",
    ]);
  });

  it("refuses a note id another field or note uses", () => {
    expect(messages(conversation(), conversation({ id: "second" }))).toEqual([
      'Conversation\'s note id "aware_note" is already in use. Give it its own',
    ]);
  });
});

describe("an expert message block", () => {
  const message = (
    expert: ExpertMessageBlock["expert"],
  ): ExpertMessageBlock => ({
    type: "display",
    kind: "expertMessage",
    id: "intro",
    expert,
    text: "I'm *Dr Maria*.",
  });

  it("needs an expert to save", () => {
    expect(
      validateFormSchema(schema(message(null))).map((error) => error.message),
    ).toEqual(["Expert message has no expert. Pick one"]);
    expect(
      validateFormSchema(schema(message({ userId: 7, userName: "Dr Maria" }))),
    ).toEqual([]);
  });

  it("credits the expert in display-only Markdown", () => {
    expect(
      displayOnlyMarkdown({
        blocks: [message({ userId: 7, userName: "Dr Maria" })],
        videoLink: "https://example.org/actions/1",
      }),
    ).toBe("> **Dr Maria**\n>\n> I'm *Dr Maria*.");
  });
});
