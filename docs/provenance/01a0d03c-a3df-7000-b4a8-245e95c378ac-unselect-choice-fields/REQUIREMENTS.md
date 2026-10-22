---
user: Charles Lien
task: Unselecting a choice in form elements
---

## User request

- A way to unselect an option in dropdowns and radio buttons, "and anything else that might need unselecting", in the form elements.

## Approval of agent proposals

The user said "yes" to this agent-authored proposal:

- Optional fields only; required fields stay as they are. Clearing sets the value to `""`, as the scale (`range`) field already does.
- Web radio: the same "Clear selection" link the web scale field shows.
- Dropdowns, web and mobile: an `X` icon button with an `aria-label` in the trigger, next to the chevron.
- Mobile radio: tapping the selected option again clears it, as mobile scale already does.
- Mobile scale's tap-again clearing respects `required`.

## Follow-up

- After seeing the optional-only version, the user said: "let's also allow unselecting of required fields". This supersedes the approved "optional fields only" and "mobile scale respects `required`" items above.
