# Decisions

## Target

The orchestrating agent assigned this waiver so that parallel agents working the same request take non-overlapping files.

## Split

`CommonControls.tsx` (659 lines) splits along its validator responsibilities, the option `codex exec` recommended:

- `useCustomValidators.ts`: the validator list fetch, its module-level cache, `useCustomValidators`, and `resetCustomValidatorsCache`.
- `CustomExpressionEditor.tsx`: the `CustomExpression` validator's textarea and its tester (test-user picker, test request, results). `CustomValidatorSelect` renders it only for that validator type and passes `expression` with an `onExpressionChange` callback.
- `CustomValidatorSelect.tsx`: `CustomValidatorSelect`, the validator picker with its tag or ID argument input. `FieldWrapper` and `ValidatorRule` are its only callers, and its test file already carries its name.
- `CommonControls.tsx`: the small field toggles, `RequiredAsterisk`, and the duplicate-option helpers, which most field editors import.

Moved code is unchanged apart from imports and exports, and from what follows from the editor mounting only while the type is `CustomExpression`: it loads users unconditionally instead of behind `enabled: isCustomExpression`, drops its `isCustomExpression` guards, and no longer lists `type` among the effect deps that clear a stale test result, since a type change unmounts it. Switching the type away and back now re-picks the first active user rather than keeping the previous pick. Importers import from the new files directly; `CommonControls.tsx` does not re-export.

## api-client/named-hooks-only waiver

`CommonControls.tsx` waived `api-client/named-hooks-only` for its raw client import. The rule skips `use*.ts` files, so `useCustomValidators.ts` imports `tasksCustomValidatorsAdmin` without it, as the waiver's TODO asked: a named hook that owns its cache. The other raw call, `tasksTestCustomExpressionAdmin`, moves with the tester to `CustomExpressionEditor.tsx` and takes the waiver along; moving it into a hook is that waiver's own fix, outside this task.
