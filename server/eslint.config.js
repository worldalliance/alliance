import eslintPluginExample from "./eslint/eslint-local-rules.js";
import tseslint from 'typescript-eslint';

export default tseslint.config([
	...tseslint.configs.recommended,
	{
        plugins: {'local-rules': eslintPluginExample},
		files: ["**/*.ts"],
		rules: {
			"prefer-const": "warn",
			"no-constant-binary-expression": "error",
			"local-rules/enforce-foo-bar": "error",
		},
	},
]);