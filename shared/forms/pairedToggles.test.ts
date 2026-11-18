import type { AnyField, FormValue } from "@alliance/common/forms/form-schema";
import { pairedToggleToTurnOn } from "@alliance/common/forms/paired-toggles";
import { validateFieldValue } from "./fieldValidation";
import { answerField } from "./formValueUpdater";

const toggle = (id: string, atLeastOneOnWith?: string): AnyField => ({
  id,
  type: "input",
  kind: "toggle",
  label: id,
  ...(atLeastOneOnWith ? { atLeastOneOnWith } : {}),
});

const text = toggle("text");
const email = toggle("email", "text");
const fields = [text, email, toggle("unpaired")];

const turnOn = (
  fieldId: string,
  data: Record<string, FormValue>,
  hidden: string[] = [],
) =>
  pairedToggleToTurnOn({
    fieldId,
    data,
    fields,
    isVisible: (field) => !hidden.includes(field.id),
  });

describe("pairedToggleToTurnOn", () => {
  it("turns the partner on when either toggle goes off while it is off", () => {
    expect(turnOn("email", { text: false, email: false })).toBe("text");
    expect(turnOn("text", { text: false, email: false })).toBe("email");
  });

  it("leaves things alone while the partner is on", () => {
    expect(turnOn("email", { text: true, email: false })).toBeNull();
  });

  it("leaves things alone when the toggle goes on", () => {
    expect(turnOn("email", { text: false, email: true })).toBeNull();
  });

  it("keeps the toggle on when its only partner is hidden", () => {
    expect(turnOn("email", { text: true, email: false }, ["text"])).toBe(
      "email",
    );
    expect(turnOn("text", { text: false, email: true }, ["email"])).toBe(
      "text",
    );
  });

  it("ignores toggles with no partner", () => {
    expect(turnOn("unpaired", { unpaired: false })).toBeNull();
  });
});

describe("validating a paired toggle", () => {
  const extras = { deviceType: "desktop" as const };
  const error = (data: Record<string, FormValue>) =>
    validateFieldValue(email, data.email, data, extras);

  it("requires it while its partner is off or has no answer", () => {
    expect(error({ text: false, email: false })).toBe(
      "This field is required.",
    );
    expect(error({ email: false })).toBe("This field is required.");
  });

  it("lets it be off while its partner is on", () => {
    expect(error({ text: true, email: false })).toBeNull();
  });
});

describe("answerField", () => {
  it("answers the field and turns its off partner on", () => {
    expect(
      answerField({
        prev: { text: false, email: true },
        fieldId: "email",
        value: false,
        fields,
        isVisible: () => true,
      }),
    ).toEqual({ next: { text: true, email: false }, turnedOn: "text" });
  });
});
