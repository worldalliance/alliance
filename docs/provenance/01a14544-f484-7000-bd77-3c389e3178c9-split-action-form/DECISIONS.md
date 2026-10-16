# Split ActionForm under the 500-line limit

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

- The fix is splitting the 866-line file along cohesive boundaries, with no behavior change. Layout, from the options `codex exec` proposed per the repo's file-size rule:
  - `apps/admin/src/components/ActionReviewersEditor.tsx`: the external-reviewer list, the `ReviewerRow` type, and the icon auto-detection helpers. Its only inputs are the rows and their change callback. `useActionEditor.ts` imports `ReviewerRow` from here directly rather than through a re-export.
  - `apps/admin/src/lib/actionFieldDefs.ts`: the field types and the content and settings field definitions. `actionFieldDefs` takes the same suites input as `suiteOptions` and builds the suite options itself; `ActionForm` memoizes it on those inputs. The custom-stat and visibility-mode option lists become module constants, since they never depended on props.
  - `apps/admin/src/components/ActionFormFields.tsx`: rendering each field kind and laying a section's fields out as full-width fields, then the two-column grid, then checkboxes. `ActionFieldInputs` holds the props it reads, and `ActionFormProps` extends it so each prop is declared once. Without this extraction `ActionForm` would sit at the 500-line limit.
  - `ActionForm.tsx` keeps field selection per section and the composition of the sections, authors, prerequisites, targeting, and buttons.
- Moved code is otherwise unchanged, apart from dropping the section-heading comments in the field list. The pre-existing dead code it carries stays: the unused `inverted` field option, the unread `fileInputRef`, and the commented-out delete button with its unused `onDelete` prop.
- Nothing rendered `ActionForm` in a test, so a render test lands before the field moves. It pins each section's fields and their order, both sides of the hide rules, and that values and edits reach the callbacks. The extracted pieces also get their own unit tests.
- The waiver comes off in the commit that brings the file under the limit, because lint rejects an unused disable directive.
