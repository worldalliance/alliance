---
user: Alex Dorey
task: Add a Custom HTML Field to the admin form builder
---

## Task

In the admin panel, when defining a form, add a "Custom HTML Field" that lets the form
creator paste four things: HTML, CSS, JS, and a Field ID. The user gave this preliminary example of
how the four would be used:

- HTML: `<select id='example'><option value='y'>Yes</option><option value='n'>No</option></select>`
- CSS: `#example { color: red; }`
- JS: `document.querySelector('example').onchange=()=>{console.log('do something')};`
- Field ID: `example`

When a member goes through the form, it gets the element by that ID and includes its
value in the form response.

The user required clarifying questions before anything was built.

## Clarifications

The agent asked two rounds of multiple-choice questions and wrote every option text. The
selections below are the user's; the option wording quoted to make each selection
interpretable is the agent's.

### Isolation on web

Selected **"Inline in the page DOM"** over a sandboxed iframe. The agent's option
described this as injecting the authored markup into the form's DOM and evaluating the
JS there, and stated its consequences: authored CSS leaks both ways, and the authored JS
runs same-origin with access to cookies, localStorage and the logged-in member's API
session. A third option, shipping inline now and moving to an iframe later, was not
selected.

### Getting the value

Round one: selected **"Both"** — auto-read `.value` on `input`/`change` as the default,
_and_ expose an explicit setter for widgets that cannot be read that way.

Round one, entered as free text on the question about which field machinery to support:

> we don't have to use a field ID if there's a better way to specify how to get the value
> of the field. I just want the ability to have complex html + js embedded in the form in
> a way that works with the existing form mechancs

Round two, given that opening: selected **"Marker attribute + setValue()"** over keeping a
literal Field ID box and over an agent-recommended CSS-selector box. The agent's option
read: "Drop box 4 entirely. Whichever element carries `data-alliance-value` is the value
source. No fourth box and no 'these two strings must match' failure mode, but your pasted
snippet has to be edited to add the attribute."

So the field takes three inputs, not the four originally specified.

### Value shape

Selected **"One string value"** (the agent's recommendation) over an object of named
values. The agent's option noted that a single string means responses table, CSV export,
output views, `visibleIf` comparisons and cohort `FormFieldValue` rules work without
extra code, and that a snippet needing three answers becomes three fields.

### CSS scoping

Selected **"Auto-scope to the field"** (the agent's recommendation) over injecting the
authored CSS verbatim. The agent's option described prefixing every selector with the
field's own wrapper so `#example { color: red }` keeps working while a careless
`select { }` or `body { }` cannot restyle the rest of the form.

### Mobile

Selected **"WebView, same as HtmlBlock"** over web-only and over deferring mobile. The
agent's option described rendering the field in a `react-native-webview` reusing the
height-reporting bridge in `apps/mobile/components/forms/HtmlBlock.tsx`, plus a
postMessage channel for the value, and flagged it as the most work of the three.

### Field machinery to support

From a multi-select list, selected:

- **Required + saved-answer restore.** Honor `required`, and push a previously saved
  answer back into the element when a member resumes or navigates back. The agent's
  option noted that without restore, members silently lose the answer on back-navigation.
- **Responses table / CSV / output views.** The captured value shows up in
  `FormResponsesView`, the CSV export and output views like any other field's answer.
- **visibleIf / requiredIf formulas.**

Not selected: **usable inside a List field**. The agent's option for it noted that
allowing it as a repeatable sub-field would mean IDs get namespaced per row.

### Builder UX

From a multi-select list, selected:

- **Live preview pane.** The agent's option described rendering the snippet in the
  builder as it is typed, in a sandboxed iframe, showing the captured value update live,
  and called it the most work in the list.
- **Monaco/CodeMirror editors.** Syntax-highlighted code boxes instead of plain
  textareas. The agent's option said to check first whether the admin app already bundles
  an editor, else it is a new dependency.

Not selected: **warn on no value source** (a save-time check for a marker attribute that
matches nothing and a script that never sets a value), and **plain textareas, nothing
else**.

## Unknown provenance

The user did not state which repository to build in. The agent stated an assumption and
proceeded; see DECISIONS.md.

## Follow-up: radio-group starter

After a code review (agent-authored) found that a radio group marked with
`data-alliance-value` recorded the wrong answer, the user asked to change the new field's
starter example to a radio group choosing between "environmental destruction", "global
poverty", "dangerous technology" and "democratic decline", and to fix the runtime so that
example works.

## Follow-up: CSS scoping after statement at-rules

The same review (agent-authored) found that a style rule following a statement at-rule
such as `@import …;`, `@charset …;` or `@layer a, b;` was passed through unscoped. Its
suggested fix: copy top-level statements ending in `;` through as-is and scope only what
follows the last one. The user asked to implement that fix.
