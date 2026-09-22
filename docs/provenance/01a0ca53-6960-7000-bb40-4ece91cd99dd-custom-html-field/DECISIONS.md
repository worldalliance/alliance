# Decisions

Agent decisions and their rationale for the `customhtml` field kind (commit `1f807d9a7`).

## Schema

The kind is named `customhtml`, following the lowercase run-together style of
`multiselect` and `timezone`, and is displayed as "Custom HTML Field" — the user's own
name for it. `html` is required; `css` and `js` are optional, so an empty box is absent
from the schema rather than stored as `""`.

It was added to `anyFieldSchema` but deliberately **not** to `listSubFieldSchema`, because
the user did not select List support. The authored markup is written once and would need
re-scoping per row.

The existing `custom` kind was left alone. It is code-registered components and is marked
`@deprecated do not add any new types of custom components`, so extending it would have
meant growing something already being retired.

## The runtime contract

`shared/forms/customHtml.ts` holds one contract that all three hosts implement — the web
form, the mobile WebView, and the builder preview — so a script written against one
behaves the same in the others.

The global is named `Alliance`, exposing `value`, `setValue(v)`, `onValue(cb)`,
`onDestroy(cb)` and `root`. `onDestroy` exists because conditional visibility unmounts and
remounts fields freely, and an authored timer or document-level listener would otherwise
outlive the markup that created it.

The contract is assembled as a **string of source** rather than as functions, because the
mobile renderer has to inject it into a WebView document where it cannot close over
anything in the module.

### Reading a value

`readValue` returns `.value` for inputs, selects and textareas; the checked state for
checkboxes and radios, whose `.value` is a constant the author set; `textContent` for
contenteditable and for anything else — which is what a widget built from divs would put
there.

When there is no saved answer, the field **adopts whatever the markup already shows**, so a
select sitting on its first option counts as answered rather than empty. When there is a
saved answer, it is written onto the marked element **before** the authored script runs, so
a script that reads its own control on startup sees the restored value.

### Value attribute naming

`data-alliance-value` for the marker and `data-alliance-custom-html` for the scope
wrapper. The marker name appeared in the option the user selected; the scope attribute is
purely internal, and both are exported as constants so the builder's help text and the
tests cannot drift from the runtime.

## CSS scoping

`scopeCustomCss` is a scanner, not a full CSS parser: it finds rule boundaries and
rewrites selector lists, leaving declarations untouched. A real parser was not worth the
dependency for the one transformation needed.

- `:root`, `html`, `body`, `&`, `:scope` and `*` map onto the wrapper itself. An author
  writing `body { font-size: 20px }` means their own block, and `<scope> body` matches
  nothing.
- `@media`, `@supports`, `@container`, `@layer`, `@scope`, `@starting-style` and
  `@document` are recursed into. `@keyframes`, `@font-face` and `@page` pass through
  untouched — prefixing `from`/`50%` or a descriptor block produces CSS the browser drops.
- Comments are stripped from selector lists before splitting. They are inert to the
  browser, but a comma inside one would otherwise split a selector in two.
- Unbalanced CSS passes through rather than being dropped, since that is what the browser
  would do with it anyway.

An early implementation emitted `selector{...}` with no space and left comments inside the
rewritten selector. Both were fixed toward readable output rather than by loosening the
tests.

## Web renderer

`sharedweb/forms/CustomHtmlField.tsx` sets `innerHTML`, prepends a scoped `<style>`, and
runs the contract plus the authored script through `new Function`, which returns the
teardown handle.

The initialization effect depends only on `html`, `css` and `js`. The current answer and
the `onChange` handler reach it through refs, because re-running on either would tear down
a widget mid-interaction. Re-mounting on an edit is also what makes the builder preview
live.

Initialization is wrapped in `try`/`catch`: a syntax error in authored JS logs and leaves
the rest of the form standing rather than taking it down.

`disabled` is expressed as `inert` plus reduced opacity. Authored markup owns its own
interactivity, so that is the only thing the host can meaningfully do to it from outside.

## Mobile and the builder preview

Both render a whole document built by `buildCustomHtmlDocument`, differing only in how
they bridge messages out — `ReactNativeWebView.postMessage` on mobile,
`parent.postMessage` in the preview. Two message kinds: `{type: "value"}` and
`{type: "height"}`. The height message exists because neither host can size itself around
content it does not control.

Height is measured from the **wrapper element**, not `document.documentElement`. Browser
verification showed that an iframe's `documentElement.scrollHeight` reports its viewport,
which padded a one-line field out to 150px; measuring the wrapper gives 29px.

The mobile WebView is rebuilt only when `html`/`css`/`js` change. Rebuilding on every
answer would reload the WebView and discard the widget's own state mid-interaction, so
the saved answer is baked in once and updates flow outward only.

**The builder preview is sandboxed** (`allow-scripts` without `allow-same-origin`) even
though the real web renderer is inline, as the user chose. A half-written script should
not be able to take the form builder down, and an opaque origin keeps the preview away
from the admin session.

## Builder editor

CodeMirror 6 (`@uiw/react-codemirror` plus the HTML, CSS and JavaScript language packs)
rather than Monaco. The admin app bundled neither, so this is a new dependency either way;
Monaco is much heavier and awkward under this app's react-router setup. The user's option
named both, so the choice between them was the agent's. Admin runs `ssr: false`, so the
editor can be imported directly with no client-only guard.

Three tabs, each with its own always-mounted editor hidden when inactive, rather than one
editor swapping language: remounting would discard each language's undo history and
folding state.

The preview reads through `useDeferredValue`, so React can skip intermediate states and
the iframe does not reload on every keystroke while typing stays responsive.

A new field is created with working starter markup — a `<select>` already carrying
`data-alliance-value` — so it is wired up before the admin types anything, and the
value contract is demonstrated rather than only described.

Help text under the controls names the marker attribute and `Alliance.setValue()`, and
states that CSS is scoped. The user did not select the save-time "no value source"
warning, so there is no static check; the live preview reports "nothing yet" instead.

## Integration with existing field machinery

Most of these were forced by exhaustive `Record<FieldKind, …>` maps, which is how they
were found — the schema change was made first and `tsc` located every site.

- **`validateFieldValue`** groups `customhtml` with the text-like kinds: required plus a
  non-empty string.
- **Known form element kinds** gained an entry. This is the gate that blocks rendering
  when a schema references elements a client is too old to know, so it is what protects
  existing mobile builds from a `customhtml` field they cannot render.
- **Variable input mode** is `Text` — the answer is whatever string its author decided on,
  but it is still a string a formula can read and compare.
- **Variable interpolation** is enabled (it covers label, description and placeholder) and
  option-label interpolation is disabled. The authored HTML is deliberately left alone;
  interpolating into it was out of scope.
- **Responses table** uses the plain-text cell renderer and text comparator: the authored
  markup decides what the string means, so the table can only show it as written.
- **HTML export** stringifies it alongside the other plain-value kinds.
- No migration was needed. Form schemas are stored as JSON and a new kind is additive.

## Verification

24 tests were added: `shared/forms/customHtml.test.ts` covers the CSS scoper and document
builder, and `sharedweb/forms/CustomHtmlField.test.tsx` covers the web renderer end to end
— auto-capture, adoption, restore, `setValue`, scoping, a throwing script, and teardown on
unmount.

Beyond the tests, the generated sandbox document was driven in a real browser, which is
what surfaced the height bug above. `bun` cannot exercise a real `ResizeObserver` or
iframe, so that path is otherwise unverified by the suite.

## Residual risk

Rendering inline was the user's explicit choice, and it means authored JS runs
same-origin with the member's session: it can read cookies and call the API as them. The
set of people who can edit forms is now also the set of people who can run JavaScript in a
member's browser. This was flagged to the user at delivery. The sandboxed builder preview
limits the blast radius while authoring, but not at render time.

## Radio groups

A radio group is marked by putting `data-alliance-value` on an element that contains the
radios, since browsers fire no event on the radio that gets unchecked. When the marked
element is not itself a form control and contains any `input[type="radio"]`, its answer is
the checked radio's `value`, or `""` when none is checked, and a saved answer is restored
by checking the radio whose `value` matches. The group starts unanswered, so `required`
applies until the member picks one.

The starter uses kebab-case slugs as radio values, so answers read cleanly in the
responses table and formulas, and adds `label { display: block; }` so the options stack.

## Statements before a rule

`scopeCustomCss` splits the text before each `{` at its last top-level `;`, skipping
strings, comments, parentheses and brackets, so a `;` inside an unquoted `url(…)` or an
attribute selector does not count. Everything up to that `;` is copied verbatim; the rest
is the rule's prelude. Because nested at-rule bodies go through the same function, this
also applies inside `@media` and similar blocks.
