---
user: Charles Lien
task: Specify an intuitive admin form editor centered on the rendered form, conditional visibility, and navigation
---

## Direct user requests and preferences

- The current admin form editor feels extremely clunky. Managing conditions is the worst part; clutter also makes navigating and understanding one's position in the form difficult.
- Suggested showing the form itself by default, with a presentation similar to a preview, and clicking an individual element to edit its properties.
- Asked to compare a settings sidebar with a modal using sample screenshots, then explicitly chose the sidebar.
- Asked to inspect staging to determine which condition patterns are common.
- Expected the work to be frontend-only, while allowing server changes if needed. This was a question about scope, rather than a requirement to change the server.

## Agent proposals approved by the user

The following designs originated with the agent. The user approved them through “go with your recommendation” and two rounds of “recommended for all.”

### Canvas, navigation, and scope

- Show the rendered form as the editing workspace. Clicking an input selects its element; answering questions belongs in the existing Preview mode.
- Edit labels, headings, and body text directly on the canvas. One click selects an element; a pencil control or Enter starts editing, preserving Markdown and variable suggestions.
- Show conditional elements while editing, with a condition indicator and a subtle boundary around visibility groups. Preview applies actual conditions.
- Use a compact outline of pages and elements on the left and a searchable insertion picker between elements. Select a newly inserted element immediately.
- Apply the redesign to forms and the update content editors sharing the builder. Defer redesigning output views and the other builder tabs.
- Make list sub-fields and accordion blocks selectable on the canvas and in expandable outline entries. Show one example list row; accordion sections can expand while editing.
- Keep the sidebar persistent on desktop. In narrow windows, use a drawer that closes to return to the form.

### Conditions and dependencies

- Offer All conditions / Any condition controls for common combinations and an advanced expression editor for complex logic. Preserve existing complex expressions exactly.
- Expose negative checks, including “is not” and “is unanswered,” directly in the simple editor.
- Show a selected question's dependents within the current form, including page conditions, and provide clickable navigation in both directions. Open source questions from another form in a new tab to preserve current edits.
- Create shared visibility by selecting consecutive elements. Provide group condition editing, detach, split, and ungroup in the sidebar.
- Identify groups by their condition summary and member count; saved group names are unnecessary.
- When selected elements have differing conditions, show the rules and require the admin to choose or write the shared replacement.
- Preserve an advanced expression when removing a condition breaks it, and require repair instead of resetting the expression.

### Drafts, errors, and personalized content

- Update the local draft immediately and persist through explicit Save or Cmd-S. Add undo/redo for the current editing session.
- Undo/redo covers all draft changes, including JSON edits and changes from the existing builder tabs. Retain history across normal saves; reset it when opening another form or accepting a replacement version after a save conflict.
- Keep invalid conditions and broken references visible with errors. Block Save and Preview until repaired; clicking an error navigates to the affected element.
- Before deleting a source question, show affected elements and allow deletion. Keep broken references available for repair; undo restores the question.
- Normally display default block content and authored variable tokens. Selecting a user override in the sidebar displays that override with a clear “Editing content for…” indicator. Use the existing Preview-as-user control to test resolved content.
