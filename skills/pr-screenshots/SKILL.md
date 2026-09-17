---
name: pr-screenshots
description: Take screenshots/videos for this PR
disable-model-invocation: true
---

# PR screenshots

Take screenshots or videos of any of the user journeys that have changed in this branch. Capture both before and after.

Post as one comment on the PR, with the assets inside tables.

## Attach with `gh`

To post comments with `gh`:

```bash
gh issue comment <number> --body "<comment>"
gh pr comment <number> --body "<comment>"
```

To include an image inline at a specific place in the comment, reference the local file in Markdown and also pass the same file with `--attach`:

```bash
gh pr comment <number> \
  --body $'Before\n\n![result](./result.png)\n\nAfter' \
  --attach ./result.png
```

`gh` uploads `./result.png` and rewrites `![result](./result.png)` to the uploaded GitHub asset URL.

If placement does not matter, just use:

```bash
gh pr comment <number> --body "<comment>" --attach ./result.png
```

The attachment will be appended to the comment.

Optional alt text:

```bash
--attach './result.png#Description of image'
```
