import columnOptionalityRule from "./column-optionality.mjs";
import noReturnedThenableRule from "./no-returned-thenable.mjs";
import relationOptionalityRule from "./relation-optionality.mjs";

const plugin = {
  rules: {
    "column-optionality": columnOptionalityRule,
    "no-returned-thenable": noReturnedThenableRule,
    "relation-optionality": relationOptionalityRule,
  },
};

export default plugin;
