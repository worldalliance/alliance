---
user: Charles Lien
task: Let visibility conditions reference custom inputs and fields that appear later in the form
---

- While configuring visibility conditions, admins can select custom inputs and fields that appear later in the form.
- Fields appearing later are marked differently in some way, or picking one asks for confirmation. The user left the choice between the two open.

The user approved the agent's recommendation on each of the following. All option wording is the agent's:

1. "Custom inputs" means custom component fields (`kind: "custom"`).
2. A custom component field can drive only "has value / is empty" conditions, not per-component conditions.
3. Custom component fields become selectable wherever they sit in the form, earlier as well as later.
4. Later fields are listed under a "Later in form" heading in the picker, and an amber warning appears under a condition that references one. There is no confirmation dialog.
5. Fields, display blocks and field groups get later-field references; list sub-fields can reference later sub-fields in the same row. Page conditions and output-view blocks keep their current rules.
6. The picker leaves out the element itself and fields nested inside it.
8. Later-field references are limited to the same page; fields on later pages stay unselectable.
9. When reordering moves a condition's source below the dependent element, the editor shows the "later" marker and warning automatically and does not block.
11. Only admin and `common` change; member-facing apps and stored data need no changes or migration.
12. The schema validator rejects visibility dependency cycles, both direct (A↔B) and chained (A→B→C→A), by reusing the existing output-block cycle search. Cycles that pass through group membership are not detected.
13. A cycle blocks saving, in the admin builder and on the server alike, with an error naming the fields involved, including for forms that already contain a cycle.
14. The picker does not hide choices that would create a cycle; the validator error reports them.

On cycle detection (item 7), the user's words: implement it "only do so if it won't require too much logic. i feel like this seems like a 'trap' feature. like obviously it would be nice to have, but seems like a deep rabbit hole." The user then approved the limited version in item 12.

On `requiredIfFormula`: "don't create new ui for requiredIf". Only visibility editing changes.
