# Decisions

## Target

The orchestrating agent assigned this waiver so that parallel agents working the same request take non-overlapping files.

## Split

`CohortExpressionBuilder.tsx` (913 lines) splits along its editing layers, the option `codex exec` recommended and the smallest change:

- `CohortLeafEditors.tsx`: `LeafConditionEditor` and the per-condition editors (`TagEditor`, `ManualEditor`, `ActionSelectEditor`, `FormFieldEditor`, `UnmatchedOption`).
- `ExpressionNodeEditor.tsx`: the recursive tree editor (`ExpressionNodeEditor`, `BooleanOperatorEditor`) and its helpers (`LEAF_TYPES`, `OPERATOR_TYPES`, `operatorChildren`, `createDefaultLeaf`). The two editors call each other, so they share a file.
- `CohortExpressionBuilder.tsx`: the builder itself, with the clipboard menu, presets, and comparison.

Moved code is unchanged apart from imports and exports.

## Props threading

The leaf editors read only the tag, action, and user lists with their loading and error flags, so those fields become `CohortLeafEditorSources` in `CohortLeafEditors.tsx`, and the builder's props extend it. The tree editors take `ExpressionEditorContext`, which adds the selected sub-expression. That replaces the builder's `@internal` `_selectedExpr` prop: no caller passed it, and keeping it on the public props would have the new files import the builder's props type, which imports them.

The tests import `TagEditor` and `ActionSelectEditor` from their new file; the builder does not re-export them.
