import type {
  CheckboxField,
  CustomComponentField,
  PhoneField,
  TextField,
} from "@alliance/common/forms/form-schema";
import {
  getExtractionLabel,
  hasExtractionEnabled,
  supportsExtraction,
} from "./fieldExtraction";

const text: TextField = {
  id: "t",
  type: "input",
  kind: "text",
  label: "Text",
};
const phone: PhoneField = {
  id: "p",
  type: "input",
  kind: "phone",
  label: "Phone",
};
const checkbox: CheckboxField = {
  id: "c",
  type: "input",
  kind: "checkbox",
  label: "Checkbox",
};
const custom: CustomComponentField = {
  id: "x",
  type: "input",
  kind: "custom",
  label: "Custom",
  componentId: "share-url",
  autoExtractUserData: { target: "shareInfoPublicly" },
};

describe("supportsExtraction", () => {
  it("accepts auto-extract kinds and rejects others", () => {
    expect(supportsExtraction(phone)).toBe(true);
    expect(supportsExtraction(checkbox)).toBe(true);
    expect(supportsExtraction({ ...text, kind: "textarea" })).toBe(true);
    expect(supportsExtraction({ ...text, kind: "file" })).toBe(true);
    expect(supportsExtraction(text)).toBe(false);
  });
});

describe("hasExtractionEnabled", () => {
  it("reads the boolean flag on scalar kinds", () => {
    expect(hasExtractionEnabled(phone)).toBe(false);
    expect(hasExtractionEnabled({ ...phone, autoExtractUserData: true })).toBe(
      true,
    );
  });

  it("requires a target on checkbox kinds", () => {
    expect(hasExtractionEnabled(checkbox)).toBe(false);
    expect(
      hasExtractionEnabled({
        ...checkbox,
        autoExtractUserData: { target: "shareInfoPublicly" },
      }),
    ).toBe(true);
  });

  it("reads the target on custom components", () => {
    expect(hasExtractionEnabled(custom)).toBe(true);
    expect(
      hasExtractionEnabled({ ...custom, autoExtractUserData: undefined }),
    ).toBe(false);
  });
});

describe("getExtractionLabel", () => {
  it.each([
    ["phone", "Extracting into: Phone number"],
    ["time", "Extracting into: Preferred reminder time"],
    ["timezone", "Extracting into: Time zone"],
    ["city", "Extracting into: City"],
    ["textarea", "Extracting into: Profile description"],
    ["file", "Extracting into: Profile photo"],
    ["image", "Extracting into: Profile photo"],
    ["timePicker", "Extracting into: Preferred reminder time"],
  ] as const)("names the %s user data", (kind, label) => {
    expect(getExtractionLabel({ ...phone, kind })).toBe(label);
  });

  it("names the target of checkbox and custom fields", () => {
    expect(getExtractionLabel(custom)).toBe(
      "Extracting into: Share info publicly",
    );
    expect(
      getExtractionLabel({
        ...checkbox,
        autoExtractUserData: { target: "shareInfoPublicly" },
      }),
    ).toBe("Extracting into: Share info publicly");
    expect(
      getExtractionLabel({
        ...checkbox,
        autoExtractUserData: { target: "emailNotifications" },
      }),
    ).toBe("Extracting into: Email notifications");
    expect(getExtractionLabel(checkbox)).toBe("Extracting into user data");
    expect(
      getExtractionLabel({
        ...checkbox,
        kind: "toggle",
        autoExtractUserData: { target: "textNotifications" },
      }),
    ).toBe("Extracting into: Text notifications");
  });
});
