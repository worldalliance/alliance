Retain optional API fields for older clients. Normalize blank strings to null, accept boolean commitment values, and record a commitment timestamp only for explicit true. Preserve existing timestamps. Remove the database constraint requiring a reason without an organization.

The generated migration included four unrelated index drops; remove those to keep the change scoped to waitlist fields. Reuse the reason-constraint removal from the migration now on main; this task’s migration only makes the commitment timestamp nullable. Rollback fails if new entries lack the formerly required data rather than inventing reasons or commitments.

After applying the migration locally, regeneration reports only the same four unrelated index drops and no waitlist differences. Request and migration e2e tests cover the DTO and service files that the unit-only coverage check does not load.

Place a compact Alliance panel directly above signup. Give its purpose a short paragraph and its weekly commitment a separate clock row so visitors can scan both.

Reconcile the work with main commit 98a98b7e2. Keep the upstream invitation message and test helper; preserve the page layout and optional commitment changes. Test the upstream reason migration followed by this task’s commitment migration.

In the stacked layout, use a first-viewport minimum height except when height is at least twice width and exceeds 900px. Center the hero and progress bar together within that minimum, leaving the bar directly beneath signup. At medium widths, add four rem of bottom padding to shift the centered group upward two rem; retain ordinary padding when the viewport minimum is relaxed. Remove desktop growth from the progress container as well, increasing desktop padding to account for the join section’s existing vertical translation.

Check both 393×852 portrait and 852×393 landscape because the reported dimensions do not specify orientation. Reduce hero top padding by one rem only when width is at most 480px and height at most 700px. Compare measured geometry before and after at the approved sizes to confirm their spacing and text scaling are preserved.
