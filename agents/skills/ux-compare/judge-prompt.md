# UX review: {{SURFACE}}

Review one surface of the Alliance's software against established practice and comparable products. Change nothing in the repository; your final message is your whole output. You are one step of a ux-compare run, so skip the `ux-compare` skill: it is the run's own procedure, not yours.

## Material

Your material is what this list names. Read nothing else under `.scratch/`: other reviews of this surface are there, and yours must be independent of them.

- `{{RUN}}/context.md`: the surface, its users and the product's constraints. The constraints there outrank any guideline or competitor pattern.
- `{{RUN}}/ours/`: the surface as it is, one PNG per state, named for the state.
- `{{RUN}}/refs/<product>/`: comparable established products in the same states, where they have them.
- `agents/skills/ux-guidelines/SKILL.md`: the checklist to score against, each item labelled with its status.
- The surface's source code, named in `context.md`, for what a screenshot can't show: keyboard handling, accessible names, error and loading paths.

## Review

Go through every guideline item that applies to this surface, and every state in `ours/`. Then compare each state with the reference products: polish (alignment, spacing, type, hierarchy), clarity, the number of steps and decisions a task takes, feedback, error recovery, and anything a reference product handles that ours leaves to the user.

An item is a specific difference a user would notice, tied to evidence: a screenshot file, a guideline item, a reference product's file or a source line. Report what the evidence shows. Where a claim rests on judgment rather than a guideline, say so.

## Output

One section per item, most important first:

```
### <short title>
- Evidence: <files, guideline item, source lines>
- Basis: <guideline item and its status letter, a reference product's pattern, or judgment>
- Impact: high | medium | low, and who it affects
- Directions: <two or three different ways to address it, one line each>
```

Then a short list of what the surface already does well, so it survives later changes.
