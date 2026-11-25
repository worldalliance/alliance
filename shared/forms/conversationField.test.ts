import type {
  ConversationField,
  FormValue,
} from "@alliance/common/forms/form-schema";
import { act, renderHook } from "@testing-library/react";
import { validateFieldValue } from "./fieldValidation";
import { answerField } from "./formValueUpdater";
import { EXPERT_TYPING_MS, useExpertTyping } from "./useExpertTyping";

const field: ConversationField = {
  id: "aware",
  type: "input",
  kind: "conversation",
  label: "Aware",
  required: true,
  expert: { userId: 7, userName: "Dr Maria" },
  message: "Were you aware?",
  options: [
    { label: "Yes", value: "yes" },
    { label: "Not convinced", value: "skeptic", note: { required: true } },
    { label: "Maybe", value: "maybe", note: {} },
  ],
  noteId: "aware_note",
};

const extras = { deviceType: "desktop" as const };
const validate = (data: Record<string, FormValue>) =>
  validateFieldValue(field, data[field.id], data, extras);

describe("validateFieldValue on a conversation", () => {
  it("requires a choice when the field is required", () => {
    expect(validate({})).toBe("Please select an option.");
    expect(validate({ aware: "yes" })).toBeNull();
  });

  it("requires a note only after an option whose note is required", () => {
    expect(validate({ aware: "skeptic" })).toBe("Please add a note.");
    expect(validate({ aware: "skeptic", aware_note: "  " })).toBe(
      "Please add a note.",
    );
    expect(validate({ aware: "skeptic", aware_note: "why" })).toBeNull();
    expect(validate({ aware: "maybe" })).toBeNull();
  });
});

describe("answerField on a conversation's note", () => {
  it("clears the conversation's error once the note satisfies it", () => {
    const { next, clearedErrors } = answerField({
      prev: { aware: "skeptic" },
      fieldId: "aware_note",
      value: "because",
      fields: [field],
      isVisible: () => true,
      validate: (f, value, data) => validateFieldValue(f, value, data, extras),
    });
    expect(next).toEqual({ aware: "skeptic", aware_note: "because" });
    expect(clearedErrors).toEqual({ aware: null });
  });
});

describe("useExpertTyping", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const render = (choice: string | undefined, reduceMotion = false) =>
    renderHook((props) => useExpertTyping(props), {
      initialProps: { choice, reduceMotion },
    });

  it("doesn't type for the choice the field opened with", () => {
    expect(render("yes").result.current).toBe(false);
  });

  it("types after a pick, then stops", () => {
    const { result, rerender } = render(undefined);
    rerender({ choice: "skeptic", reduceMotion: false });
    expect(result.current).toBe(true);
    act(() => jest.advanceTimersByTime(EXPERT_TYPING_MS));
    expect(result.current).toBe(false);
  });

  it("never types with reduce motion on", () => {
    const { result, rerender } = render(undefined, true);
    rerender({ choice: "skeptic", reduceMotion: true });
    expect(result.current).toBe(false);
  });
});
