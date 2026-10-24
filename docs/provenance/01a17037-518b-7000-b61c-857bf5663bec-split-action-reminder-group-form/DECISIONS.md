## Fix

The waiver defers splitting a file over the 500-line limit, so the fix is the split.

## Reset before the split

When `initialValues` changes, as when an admin picks a preset, the form reloads its fields from them, except the push message and "Use suite task count", which kept their old values. So picking "Announcement" after opening the form left the default push message in place. The reload now covers them too. The fix lands before the split because the split loads the initial state and the reload from one function, which would otherwise change this behavior without its own test.
