## Target

The orchestrating agent assigned the `CommunityPage.tsx` waiver so that agents running the same workflow in parallel take non-overlapping files (REQUIREMENTS.md).

## Fix

The waiver defers splitting a page over the 500-line `alliance/max-lines` limit, so the fix is the split, with no behavior change. Of the splits `codex exec` proposed, the group editor is the page's largest cohesive responsibility:

- `apps/frontend/src/lib/useCommunityEditor.ts` owns the draft settings, validation, and save, cancel, and delete.
- `apps/frontend/src/components/CommunityProfile.tsx` renders the group's photo, name, and description, and the leader's edit controls and settings form.

The hook stays mounted on the page, not inside `CommunityProfile`, because the page hides the profile card on the "groups" tab, and unmounting it would drop an unsaved draft.

Initializing the draft on a community change and restoring it on cancel shared the same field-by-field reset, with cancel computing the member count inline. Both now call one `resetDraft`, using `getMemberCount`, which computes the same value.

`CommunityCreateForm` renders a similar settings form, but over a create DTO with different labels, ids, and bounds; merging the two is outside this change.

## Tests

`CommunityPage.test.tsx` had no coverage of editing. It now covers save, cancel, and delete, their failure messages, the starting capacity, and the settings rules: a public group forces member invites and staff assignments on, each access setting saves on its own, and the capacity is required while any setting opens the group and is sent as null otherwise. The tests pass against both the unsplit page and the split one.

The test commit lands after the split rather than before it, so the split could be pushed while review of the tests continued; neither depends on the other.
