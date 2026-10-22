---
user: Alex Dorey
task: Bound the admin actions page into two scrollable boxes, ordered most-recent-first
---

# Requirements

Scope is the admin panel page at `http://localhost:5174/actions`.

- Order the actions most-recent-first.
- Put them in a box vertically limited to some percentage of the page, so that it is visible that there is content underneath.
- Put the content underneath in a different box that also scrolls.

## Follow-up

- The timeline's date columns (18 Sep, 19 Sep, 20 Sep, 21 Sep) are too wide.
- Each vertical line should represent a week, Tuesday to Tuesday.
- Each day's column should be much skinnier: 20% of its current width, so a week is 140% of the
  width of a current day.

## Follow-up: bars not landing on the Tuesday lines

- Most actions launch on a Tuesday, so their bars should sit at the beginning of the week's tick
  mark; they looked like they started a day after Tuesday.
- Asked whether this was a timezone problem.
- Selected, from options the agent offered: render each phase from the start of its day and remove
  the hardcoded 4px gutter, accepting that sub-day precision is lost at this zoom.
- Selected, from options the agent offered: keep day and week boundaries on the viewer's local
  time rather than pinning them to a fixed timezone.
