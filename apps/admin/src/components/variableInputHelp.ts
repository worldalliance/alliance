import {
  fieldHasOptions,
  type AnyField,
} from "@alliance/common/forms/form-schema";
import {
  isSourceInput,
  VARIABLE_INPUT_NAME_REGEX,
  type VariableInput,
} from "@alliance/common/forms/variable-inputs";
import { VariableInputMode } from "@alliance/common/forms/variables";
import {
  AGGREGATE_INPUT_HELP,
  INPUT_MODE_HELP,
  LIST_INPUT_HELP,
  SOURCE_INPUT_HELP,
  type InputModeHelp,
} from "./VariableHelpModal";
import { inputModeOf } from "./VariableSamples";

export const inputHelp = (
  input: VariableInput,
  field: AnyField | undefined,
): InputModeHelp => {
  const help = answerHelp(input, field);
  return !isSourceInput(input)
    ? help
    : {
        notes: `${SOURCE_INPUT_HELP.notes} ${help.notes}`,
        example: (name) =>
          SOURCE_INPUT_HELP.example({
            input: name,
            each: help.example("answer"),
            holdsArray:
              input.kind === "sourceList" ||
              inputModeOf(field) === VariableInputMode.Choices,
          }),
      };
};

export const answerHelp = (
  input: VariableInput,
  field: AnyField | undefined,
): InputModeHelp => {
  switch (input.kind) {
    case "field":
    case "sourceField":
      return INPUT_MODE_HELP[inputModeOf(field)];
    case "list":
    case "sourceList":
      return {
        notes: LIST_INPUT_HELP.notes,
        example: (name) =>
          LIST_INPUT_HELP.example(
            name,
            Object.values(input.properties).find((property) =>
              VARIABLE_INPUT_NAME_REGEX.test(property),
            ),
          ),
      };
    case "aggregate": {
      const value =
        field && fieldHasOptions(field) ? field.options[0]?.value : undefined;
      return {
        notes: AGGREGATE_INPUT_HELP.notes,
        example: (name) => AGGREGATE_INPUT_HELP.example(name, value),
      };
    }
    default:
      throw new Error(`unknown input kind: ${input satisfies never}`);
  }
};

export type OptionsRecipe = { purpose: string; snippet: string };

/** Formulas giving choices from the inputs that read other choices. */
export const optionsRecipes = (
  inputs: readonly {
    name: string;
    input: VariableInput;
    field: AnyField | undefined;
  }[],
): OptionsRecipe[] => {
  const recipes: OptionsRecipe[] = [];
  const latestLists: string[] = [];
  for (const { name, input, field } of inputs) {
    if (input.kind !== "field" && input.kind !== "sourceField") continue;
    const mode = inputModeOf(field);
    const fromHistory = isSourceInput(input);
    if (mode === VariableInputMode.Choices && fromHistory) {
      latestLists.push(`${name}.at(-1) ?? []`);
      recipes.push(
        {
          purpose: `${name}: the latest submission's selections`,
          snippet: `${name}.at(-1) ?? []`,
        },
        {
          purpose: `${name}: selections across all submissions`,
          snippet: `${name}.flatMap(answer => answer ?? [])`,
        },
      );
    } else if (mode === VariableInputMode.Choices) {
      recipes.push({
        purpose: `${name}: the selections made`,
        snippet: `${name} ?? []`,
      });
    } else if (mode === VariableInputMode.Choice && fromHistory) {
      recipes.push({
        purpose: `${name}: the choice made in each submission`,
        snippet: `${name}.filter(answer => answer)`,
      });
    } else if (mode === VariableInputMode.Choice) {
      recipes.push({
        purpose: `${name}: the choice made`,
        snippet: `${name} ? [${name}] : []`,
      });
    }
  }
  if (latestLists.length > 1) {
    const [first, ...rest] = latestLists;
    recipes.push({
      purpose: "The latest selections of each input, together",
      snippet: `(${first}).concat(${rest.join(", ")})`,
    });
  }
  recipes.push({
    purpose: "A choice of your own",
    snippet: "[{ label: 'Other', value: 'other' }]",
  });
  return recipes;
};
