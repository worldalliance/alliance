import columnOptionalityRule from "./column-optionality.mjs";
import relationOptionalityRule from "./relation-optionality.mjs";

const plugin = {
  rules: {
    "column-optionality": columnOptionalityRule,
    "relation-optionality": relationOptionalityRule,
  },
};

export default plugin;
