# Decisions

## Drop a row's error when lastWayIn changes

A refused disconnect reloads the member. If the reload makes the provider the last way in, the row showed the server's refusal under `lastWayInNotice`, two versions of the same sentence. The refusal also stayed after the member set a password and the tab-return reload turned Disconnect back on, so red text claimed the only way in beside an enabled button.

`OAuthAccountLink` now clears its error whenever `lastWayIn` changes. One effect covers both cases, since each one flips `lastWayIn`. An error that doesn't flip it, such as a refusal whose reload changes nothing, stays on screen.

Rejected: hiding the error while `lastWayIn` is true. That fixes the stacked sentences but not the stale refusal after a password lands, so it would need the effect anyway.

Rejected: skipping `setError` on a 400 once `refreshUser` returns. It hides the refusal even when the reload changes nothing, and the member gets no answer to their click.

## Not fixed here

- "Signing in with Google as ..." reads like progress text. It's a wording preference rather than wrong copy, and mobile settings uses the same sentence.
- Mobile settings shows a server refusal the same way. It doesn't reload the member after a refusal yet, so it can't stack the two sentences. It will need this fix when it does.
