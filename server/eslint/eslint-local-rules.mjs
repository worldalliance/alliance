import fooBarRule from "./enforce-foo-bar.mjs";
import noMappedTypeImportRule from "./no-mapped-type-import.mjs";

const plugin = { rules: {
    "enforce-foo-bar": fooBarRule,
    "no-mapped-type-import": noMappedTypeImportRule,
  },
};

export default plugin;