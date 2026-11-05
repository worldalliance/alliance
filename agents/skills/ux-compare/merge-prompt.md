# Merge UX reviews: {{SURFACE}}

Four judges, two Claude (`claude-1`, `claude-2`) and two Codex (`codex-1`, `codex-2`), reviewed the same surface independently. Their reviews are in `{{RUN}}/judges/<judge>.md`; the material they reviewed is described in `{{RUN}}/context.md`. Change nothing in the repository; your final message is your whole output. You are one step of a ux-compare run, so skip the `ux-compare` skill: it is the run's own procedure, not yours.

Merge items that describe the same difference, even when worded differently. Check each item's evidence against the files it cites and drop the ones it doesn't support, listing them at the end with the reason. Rank the rest by impact, then by agreement.

For each item:

```
### <n>. <short title>
- Raised by: <judges>, <k> of 4 (Claude <a>, Codex <b>)
- Evidence: <files, guideline item, source lines>
- Basis: <guideline item and status letter, reference product, or judgment>
- Impact: high | medium | low
- Directions: <the distinct directions the judges proposed, one line each>
- Disagreement: <where judges contradicted each other, if anywhere>
```

Then the merged list of what the surface already does well.
