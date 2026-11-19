# Evidence

Research by Claude subagents on 2026-11-19, by web search. A claim marked *(search summary)* rests on a search result, not an opened page. Status labels follow root `AGENTS.md` **Established practice**.

## Names

Question: what do products call these concepts?

- One named thing covering yes/no conditions and computed values: FHIR SDC's `variable` extension, referenced as `%name` (formal standard, https://hl7.org/fhir/uv/sdc/STU3/expressions.html); Google Sheets "Named functions" (vendor documentation, https://support.google.com/docs/answer/12504534); Excel `LAMBDA` saved in Name Manager (vendor documentation, https://support.microsoft.com/en-us/office/lambda-function-bd212d27-1cd1-4321-a34a-ccbf254b8b67).
- No study tests labels such as "variable", "condition" or "formula" with admins. Trigger-action wording studies exist (Ur et al., CHI 2014, https://www.blaseur.com/papers/TriggerActionCHI14.pdf, *search summary*), and NN/g's heuristic of matching users' own words is expert guidance, not a study (https://www.nngroup.com/articles/match-system-real-world/).

## The admin panel's existing words

Measured by the naming brainstormer, reading `apps/admin/src` at commit d0523eed87 on 2026-11-19: the old form builder's "Variables" tab (`FormBuilderHeader.tsx`, `VariableBuilder.tsx`) holds per-form named computed values; "Formula" names an options source (`OptionsSourcePicker.tsx`); "Groups" already has four meanings (community groups, visibility groups, reminder groups, participating groups); "Segment" has no admin-facing use.
