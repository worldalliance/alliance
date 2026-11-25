---
user: Alex Dorey
task: Spec a task form grouping that lets multiple elements show up in a group with a common grey background, the same grey as the Quote block.
---

# Requirements

- Staff building a task form can put several consecutive elements of a page into a group, and members see that group's elements inside one shared grey box. (user-originated)
- The box's background is the Quote block's grey, `bg-zinc-100`, on web and mobile. (user-originated)
- Groups do not nest: a group never contains another group. (user-originated)
- A group can contain question fields as well as display blocks. (user-originated)
- The box has rounded corners on web as well as on mobile. (agent-proposed, user-approved)
- The grouping is purely visual: each page keeps its flat list of elements, and each element carries an optional group marker that the renderers draw as one box around consecutive members. (agent-proposed, user-approved)
- A group has no title of its own. Staff who want a heading put a Header block first inside the group, and that heading names the group for assistive technology; a group without one is a plain box. (agent-proposed, user-approved)
- The schema, validation, renderers and builder UI ship in one PR; the contrast fix for controls inside the box is a separate PR. (user-originated)
