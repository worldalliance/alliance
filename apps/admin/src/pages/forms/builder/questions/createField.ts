import { conversationNoteId } from "@alliance/common/forms/conversation";
import {
  type AnyField,
  type FieldKind,
} from "@alliance/common/forms/form-schema";
import { customComponentRegistry } from "@alliance/sharedweb/forms/components";

export const createField = (kind: FieldKind, id: string): AnyField => {
  switch (kind) {
    case "text":
      return {
        id,
        type: "input",
        kind: "text",
        label: "Text field",
        required: false,
      };
    case "textarea":
      return {
        id,
        type: "input",
        kind: "textarea",
        label: "Text area field",
        required: false,
        rows: 3,
      };
    case "email":
      return {
        id,
        type: "input",
        kind: "email",
        label: "Email field",
        required: false,
      };
    case "phone":
      return {
        id,
        type: "input",
        kind: "phone",
        label: "Phone field",
        required: false,
        placeholder: "Enter phone number",
        autoExtractUserData: false,
      };
    case "number":
      return {
        id,
        type: "input",
        kind: "number",
        label: "Number field",
        required: false,
      };
    case "range":
      return {
        id,
        type: "input",
        kind: "range",
        label: "Range field",
        required: false,
        optionCount: 10,
        startLabel: "",
        endLabel: "",
      };
    case "checkbox":
      return {
        id,
        type: "input",
        kind: "checkbox",
        label: "Checkbox field",
        required: false,
      };
    case "radio":
      return {
        id,
        type: "input",
        kind: "radio",
        label: "Radio field",
        required: false,
        options: [{ label: "Option 1", value: "option1" }],
      };
    case "select":
      return {
        id,
        type: "input",
        kind: "select",
        label: "Select field",
        required: false,
        options: [{ label: "Option 1", value: "option1" }],
      };
    case "multiselect":
      return {
        id,
        type: "input",
        kind: "multiselect",
        label: "Multi-select field",
        required: false,
        options: [{ label: "Option 1", value: "option1" }],
      };
    case "date":
      return {
        id,
        type: "input",
        kind: "date",
        label: "Date field",
        required: false,
      };
    case "time":
      return {
        id,
        type: "input",
        kind: "time",
        label: "Time field",
        required: false,
        autoExtractUserData: false,
      };
    case "timezone":
      return {
        id,
        type: "input",
        kind: "timezone",
        label: "Timezone field",
        required: false,
        autoExtractUserData: false,
      };
    case "city":
      return {
        id,
        type: "input",
        kind: "city",
        label: "City field",
        required: false,
        placeholder: "Search for a city",
        minLength: 1,
        autoExtractUserData: false,
      };
    case "file":
      return {
        id,
        type: "input",
        kind: "file",
        label: "File field",
        required: false,
      };
    case "contract":
      return {
        id,
        type: "input",
        kind: "contract",
        label: "Contract field",
        required: false,
        contractId: null,
        signQuestion: "Sign the contract?",
        yesLabel: "Yes",
        noLabel: "No",
      };
    case "list":
      return {
        id,
        type: "input",
        kind: "list",
        label: "List field",
        fields: [],
        defaultNumber: 0,
        min: 0,
        required: false,
      };
    case "ranking":
      return {
        id,
        type: "input",
        kind: "ranking",
        label: "Ranking field",
        required: false,
        options: [
          { label: "Option 1", value: "option1" },
          { label: "Option 2", value: "option2" },
          { label: "Option 3", value: "option3" },
        ],
      };
    case "custom": {
      const defaultComponent = customComponentRegistry[0];
      return {
        id,
        type: "input",
        kind: "custom",
        label: "Custom component",
        required: false,
        componentId: defaultComponent?.id ?? "",
      };
    }
    case "image":
      return {
        id,
        type: "input",
        kind: "image",
        label: "Upload photo",
        required: false,
      };
    case "toggle":
      return {
        id,
        type: "input",
        kind: "toggle",
        label: "Toggle field",
        required: false,
      };
    case "timePicker":
      return {
        id,
        type: "input",
        kind: "timePicker",
        label: "Time picker field",
        required: false,
      };
    case "conversation":
      return {
        id,
        type: "input",
        kind: "conversation",
        label: "Conversation field",
        required: false,
        expert: null,
        message: "",
        options: [
          { label: "Option 1", value: "option1" },
          { label: "Option 2", value: "option2" },
        ],
        noteId: conversationNoteId(id),
      };
    default:
      throw new Error(`unknown field kind: ${kind satisfies never}`);
  }
};
