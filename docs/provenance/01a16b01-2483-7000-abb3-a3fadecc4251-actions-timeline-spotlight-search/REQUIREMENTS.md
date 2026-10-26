---
user: Alex Dorey
task: Type-to-search popup on the admin actions timeline, like macOS Spotlight
---

## User-origin requirements

- On the actions page, starting to type opens a search box centered on the page, like the macOS Spotlight search bar.
- With an empty query, the popup lists action categories, which can be typed or clicked on.
- The action ID is one way to filter: typing `183` shows action 183.

## Agent-proposed, user-approved

### Where

- The page is the admin actions timeline (`/actions` in `apps/admin`, `Actions.tsx`). No other page or app gets it.
- The popup exists only once the timeline renders. While actions are loading, or when there are no actions, typing does nothing.

### Opening

- Any printable key pressed without Cmd, Ctrl, or Alt opens the popup, and that character becomes the start of the query. This applies only while focus is not in a text field, editable element, or dialog.
- `/` opens the popup with an empty query instead of being typed.

### Searching

- Every non-archived action is searchable, regardless of which status buckets the timeline filter currently shows.
- The query matches action name, slug, and project name. Category text is not an action match field; categories are reached through the category suggestions.
- Matching is fuzzy and ranked by match quality, using `match-sorter`. Name matches rank above slug and project matches.
- At most 8 action results show. When neither a category nor an action matches, the popup shows "No matching actions" and Enter does nothing.
- Each result shows the action name, a status-bucket chip, and the project name in muted text.

### Categories

- The categories are the `ActionCategory` values, labeled and ordered Environment, Poverty, Democracy, Technology, Meta.
- Only categories used by at least one non-archived action are listed, each with a count of those actions.
- With an empty query and no category scoped, the popup lists the categories.
- While typing, categories whose label fuzzy-matches the query are listed above the action results, separate from the 8-action cap. Arrow keys move through categories and actions as one list.
- Clicking a category, or Enter on it, scopes the search to it: it becomes a chip in the input, and action results are limited to that category. With no further text, the first 8 of its actions show, latest launch first.
- One category is scoped at a time. While scoped, category suggestions are hidden.
- Backspace in an empty input removes the chip, as does the chip's x button.

### Picking an action

- Enter on the highlighted result, or clicking a result, closes the popup and scrolls the timeline to that action, both vertically to its row and horizontally to its bar's start.
- If the action's status bucket is hidden by the filter, that bucket is turned on first, then the timeline scrolls to it.
- The picked row gets a brief highlight that fades after about 2 seconds.
- The timeline does not move while the user arrows through results; it moves only on Enter or click.

### Look and closing

- The popup is a centered panel over a dimmed backdrop.
- Escape or clicking outside the panel closes it and discards the query.
