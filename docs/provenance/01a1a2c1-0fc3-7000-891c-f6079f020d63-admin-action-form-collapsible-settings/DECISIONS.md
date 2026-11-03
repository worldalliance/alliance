# Decisions

- A collapsed group that opened because one of its fields was set stays open when the admin clears that field; only the admin's own toggle closes it. Closing it under the cursor would hide the control the admin just changed. The requirement asks only that a group open by itself.
- The switch styling stays in this commit rather than its own, because the branch is to land as exactly three commits, this one among them.
- A collapsible group is an `<h3>` holding a disclosure `<button aria-expanded>`, not `<details>`/`<summary>`: a heading inside `<summary>` loses its heading role, so screen-reader users navigating by heading would skip these groups.
