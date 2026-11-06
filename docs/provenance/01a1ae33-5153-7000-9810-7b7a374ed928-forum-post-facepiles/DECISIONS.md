# Decisions

- Removing the action endpoint's tests drops no coverage of scheduled-post visibility: the same filter (`addPostVisibilityFilter`) has its own tests through the index, detail and profile endpoints in `forum.e2e-spec.ts`. (agent decision)
