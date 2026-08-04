import columnOptionalityRule from './column-optionality.mjs';
import fooBarRule from './enforce-foo-bar.mjs';
import noMappedTypeImportRule from './no-mapped-type-import.mjs';
import relationOptionalityRule from './relation-optionality.mjs';

const plugin = {
  rules: {
    'column-optionality': columnOptionalityRule,
    'enforce-foo-bar': fooBarRule,
    'no-mapped-type-import': noMappedTypeImportRule,
    'relation-optionality': relationOptionalityRule,
  },
};

export default plugin;
