# Decisions

## Target

The orchestrating agent assigned this waiver so that parallel agents working the same request take non-overlapping files.

## Split

`CommonControls.tsx` (659 lines) splits along its validator responsibilities, the option `codex exec` recommended:

- `useCustomValidators.ts`: the validator list fetch, its module-level cache, `useCustomValidators`, and `resetCustomValidatorsCache`.
- `CommonControls.tsx`: the small field toggles, `RequiredAsterisk`, and the duplicate-option helpers, which most field editors import.

Moved code is unchanged apart from imports and exports. Importers import from the new files directly; `CommonControls.tsx` does not re-export.

## api-client/named-hooks-only waiver

`CommonControls.tsx` waived `api-client/named-hooks-only` for its raw client import. The rule skips `use*.ts` files, so `useCustomValidators.ts` imports `tasksCustomValidatorsAdmin` without it, as the waiver's TODO asked: a named hook that owns its cache.
