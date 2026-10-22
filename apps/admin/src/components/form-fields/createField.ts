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
        label: "Text Field",
        required: false,
      };
    case "textarea":
      return {
        id,
        type: "input",
        kind: "textarea",
        label: "Textarea Field",
        required: false,
        rows: 3,
      };
    case "email":
      return {
        id,
        type: "input",
        kind: "email",
        label: "Email Field",
        required: false,
      };
    case "phone":
      return {
        id,
        type: "input",
        kind: "phone",
        label: "Phone Field",
        required: false,
        placeholder: "Enter phone number",
        autoExtractUserData: false,
      };
    case "number":
      return {
        id,
        type: "input",
        kind: "number",
        label: "Number Field",
        required: false,
      };
    case "range":
      return {
        id,
        type: "input",
        kind: "range",
        label: "Range Field",
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
        label: "Checkbox Field",
        required: false,
      };
    case "radio":
      return {
        id,
        type: "input",
        kind: "radio",
        label: "Radio Field",
        required: false,
        options: [{ label: "Option 1", value: "option1" }],
      };
    case "select":
      return {
        id,
        type: "input",
        kind: "select",
        label: "Select Field",
        required: false,
        options: [{ label: "Option 1", value: "option1" }],
      };
    case "multiselect":
      return {
        id,
        type: "input",
        kind: "multiselect",
        label: "Multi-Select Field",
        required: false,
        options: [{ label: "Option 1", value: "option1" }],
      };
    case "date":
      return {
        id,
        type: "input",
        kind: "date",
        label: "Date Field",
        required: false,
      };
    case "time":
      return {
        id,
        type: "input",
        kind: "time",
        label: "Time Field",
        required: false,
        autoExtractUserData: false,
      };
    case "timezone":
      return {
        id,
        type: "input",
        kind: "timezone",
        label: "Timezone Field",
        required: false,
        autoExtractUserData: false,
      };
    case "city":
      return {
        id,
        type: "input",
        kind: "city",
        label: "City Field",
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
        label: "File Field",
        required: false,
      };
    case "contract":
      return {
        id,
        type: "input",
        kind: "contract",
        label: "Contract Field",
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
        label: "List Field",
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
        label: "Ranking Field",
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
        label: "Custom Component",
        required: false,
        componentId: defaultComponent?.id ?? "",
      };
    }
    default:
      throw new Error(`unknown field kind: ${kind satisfies never}`);
  }
};
