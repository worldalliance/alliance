## Shared-suite refusal status

Agent decision. The release endpoints refuse an action whose suite holds other actions with 400, like the service's other state refusals ("already scheduled", "isn't scheduled"). 409 on `PATCH actions/:id/release` stays reserved for the deadline-shortening acknowledgement, which the admin client confirms on any 409.

## Unlisted-form fallbacks stay `Form #id`

Agent decision. `VariableInputPickers` and `FieldRule` label a form missing from the forms index `Form #<id>`. Such a form has no display slug to show, and `formLabel` falls back to the same text, so only the three pickers that render listed forms changed.

## Scheduled drafts count as planned

Agent decision. A project card counts a step as planned when `actionPhase` is Scheduled, whatever its status, so the card and the step's pill share one definition of "scheduled".
