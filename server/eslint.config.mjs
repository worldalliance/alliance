import eslintPluginExample from "./eslint/eslint-local-rules.mjs";
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
            "@typescript-eslint/no-restricted-imports": [
                "error",
                {
                  "paths": ["@nestjs/mapped-types"],
                },
            ],
		},
	},
]);