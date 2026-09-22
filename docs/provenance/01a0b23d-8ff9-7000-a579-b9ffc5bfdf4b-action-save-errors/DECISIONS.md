# Save errors

Preserve server refusal messages and login instructions for expired sessions, with a generic fallback for server failures or unstructured errors. Scroll the alert into view so an error is visible after saving from the bottom of the form.

# Session-expired copy

The admin pages share one "Your session expired. Log in again." string in `apps/admin/src/lib/sessionExpired.ts`. `refusalMessage` keeps its `sessionExpired` parameter because the shared comment hooks pass their own wording.

# Logging the rejection

The save calls map the raw rejection to its message inside `R.fromPromise`, logging it first. The result error is then a string, so dropping the mapper makes `setError` fail to typecheck instead of silently showing only the fallback.
