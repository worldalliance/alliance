## Target

The orchestrating agent assigned the `HomePage.tsx` waiver so that agents running the same workflow in parallel take non-overlapping files (REQUIREMENTS.md).

## Fix

The waiver defers splitting a page over the 500-line `alliance/max-lines` limit, so the fix is the split, with no behavior change.

- `apps/frontend/src/components/HomeGeneralUpdates.tsx` renders the updates row, the general updates load failure, and the sorted general update cards. The page rendered this block twice, once per screen size, and now renders the component in both places.
