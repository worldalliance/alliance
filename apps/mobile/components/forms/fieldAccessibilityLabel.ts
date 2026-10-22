import type { AnyField } from "@alliance/common/forms/form-schema";
import { markdownAccessibleName } from "@alliance/shared/forms/markdownAccessibleName";
import { Platform } from "react-native";

// Android's TalkBack can read an EditText's contentDescription in place of
// its typed text, so Android gets no label until it links to the visible one.
export function fieldAccessibilityLabel(field: AnyField): string | undefined {
  return Platform.OS === "android" || field.label === null
    ? undefined
    : markdownAccessibleName(field.label);
}
