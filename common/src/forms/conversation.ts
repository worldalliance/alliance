import {
  collectFieldLookup,
  type AnyField,
  type ConversationField,
  type ConversationOption,
  type FormValue,
  type Page,
  type TextareaField,
} from "./form-schema";

export function chosenConversationOption(
  field: ConversationField,
  choice: FormValue | undefined,
): ConversationOption | undefined {
  return typeof choice === "string"
    ? field.options.find((option) => option.value === choice)
    : undefined;
}

/** The note box settings for the option `data` picks, or undefined when it shows none. */
export function conversationNote(
  field: ConversationField,
  data: Record<string, FormValue>,
): ConversationOption["note"] {
  return chosenConversationOption(field, data[field.id])?.note;
}

/** The answer key the builder gives a conversation's note. */
export const conversationNoteId = (fieldId: string): string =>
  `${fieldId}_note`;

/** The note box's label: the admin's, or "Your note", marked optional unless required. */
export function conversationNoteLabel(
  note: NonNullable<ConversationOption["note"]>,
): string {
  return (
    note.label?.trim() || (note.required ? "Your note" : "Your note (optional)")
  );
}

/** Every key a field's answer is stored under: its id, and a conversation's note id. */
export function fieldAnswerKeys(field: AnyField): string[] {
  return field.kind === "conversation" ? [field.id, field.noteId] : [field.id];
}

/**
 * The note as a text field of its own, so a response view that lists one
 * answer per field gives the note its own column.
 */
export function conversationNoteField(field: ConversationField): TextareaField {
  const label = field.label?.trim();
  return {
    id: field.noteId,
    type: "input",
    kind: "textarea",
    label: label ? `${label}: note` : "Conversation note",
  };
}

/** `fields` with each conversation's note field right after it. */
export function withConversationNoteFields(fields: AnyField[]): AnyField[] {
  return fields.flatMap((field): AnyField[] =>
    field.kind === "conversation"
      ? [field, conversationNoteField(field)]
      : [field],
  );
}

export function conversationsByNoteId(
  fields: Iterable<AnyField>,
): Map<string, ConversationField> {
  const byNoteId = new Map<string, ConversationField>();
  for (const field of fields) {
    if (field.kind === "conversation") byNoteId.set(field.noteId, field);
  }
  return byNoteId;
}

/**
 * `answers` without notes whose conversation's chosen option shows no note
 * box, so a stored note always belongs to the stored choice. Returns `answers`
 * itself when nothing is stripped.
 */
export function stripOrphanedNotes(
  fields: Iterable<AnyField>,
  answers: Record<string, FormValue>,
): Record<string, FormValue> {
  let stripped = answers;
  for (const field of conversationsByNoteId(fields).values()) {
    if (!(field.noteId in answers) || conversationNote(field, answers)) {
      continue;
    }
    if (stripped === answers) stripped = { ...answers };
    delete stripped[field.noteId];
  }
  return stripped;
}

export function conversationFieldErrors(
  pages: Page[],
): { blockId: string; message: string }[] {
  const lookup = collectFieldLookup(pages);
  const noteIds = new Set<string>();
  return [...lookup.values()].flatMap((field) => {
    if (field.kind !== "conversation") return [];
    const errors: string[] = [];
    if (field.expert === null) {
      errors.push("Conversation has no expert. Pick one");
    }
    if (field.message.trim() === "") {
      errors.push("Conversation has no message. Write what the expert asks");
    }
    if (field.options.length < 2) {
      errors.push("Conversation needs at least two options");
    }
    if (lookup.has(field.noteId) || noteIds.has(field.noteId)) {
      errors.push(
        `Conversation's note id "${field.noteId}" is already in use. Give it its own`,
      );
    }
    noteIds.add(field.noteId);
    return errors.map((message) => ({ blockId: field.id, message }));
  });
}
