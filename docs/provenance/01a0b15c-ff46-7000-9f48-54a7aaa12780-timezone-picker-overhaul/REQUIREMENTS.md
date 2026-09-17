---
user: Charles Lien
task: Overhaul timezone selection on web and mobile
---

- Replace the existing timezone picker without treating implementation effort or compatibility with existing decisions as reasons to preserve it.
- Cover every existing timezone capture and selection flow on web and mobile.
- Use a conventional, searchable interface, offer every timezone a user may need, and detect the browser or device timezone without location permission.
- Keep password and OAuth signup timezone capture automatic. Do not add a timezone _step_ to signup.
- Keep the per-account backfill for accounts with no timezone.
- Keep a saved account timezone when it differs from the device timezone. Changing it requires user interaction.
- If backfill detection fails, leave the account timezone missing and retry on a later session.

Form timezone field:

- A form timezone field has one default behavior. Use the respondent's saved account timezone, then their device timezone. Remove the other default options.
- Put an automatically chosen form timezone into form state so accepting it without opening the picker submits that value.

What to keep:

- Do not bulk-migrate existing account values, including `America/Los_Angeles`.
- Do not change historical form answers.
- Keep the local database's `test action` and `test action form`, and remove the form's explicit `America/Los_Angeles` default.
- Do not use IP address or GPS timezone detection.
