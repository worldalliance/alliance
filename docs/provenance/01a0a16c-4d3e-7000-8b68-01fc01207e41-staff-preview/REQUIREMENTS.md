---
user: Charles Lien
task: Add a "staff preview" mode for actions
---

- Wants an "staff preview" mode for actions which makes the action show up on the home page (todo, etc.) for all staff.
- Purpose: to see what an action will look like before it actually goes out, i.e. before its `member_action` event.
- While in preview (before the action's `member_action` event start): submissions should not work, but the admin should still be able to type into the form, to test things like conditional visibility.
- From the start of the action's `member_action` event onward, all actions must behave exactly as they did before this change existed, regardless of whether preview is/was on or off for that action — the transition off of preview must be seamless, with no requirement to manually turn preview off before the action goes out.

## Interview answers

- There is an existing unmerged implementation of this same feature elsewhere in the repo's git history (found by the agent, on `origin/charles/admin-preview` and several backup/review branches). Told the agent to ignore it entirely and build from scratch.
- Who should see a previewed action on their home page: "people who are labeled 'staff'" — not admins. Explicitly noted: "admins and staff are different sets of people."
- The previewed action should be visually marked as a preview on the home page (not indistinguishable from a real todo).
- Of the 5 candidate blocked writes the agent listed (submit, complete, withdraw, share-code, donate): submit, complete, withdraw, and donate should be refused during preview. Share-code should still work — the user's reasoning: "since that affects the viewing experience, right?"
- Only users labeled `staff` see a previewed action on their home page — not `admin`, since the agent confirmed from code that `admin` and `staff` are separate boolean flags on `User`, and admin-panel access (where the preview toggle lives) checks `admin` only.
- Toggling preview on/off for an action: whoever can edit the action in the admin panel (in practice, admins, since admin-panel action endpoints are admin-gated).
- Accepted consequence: an admin who enables preview but isn't also labeled `staff` won't see it on their own home page. User's answer: "Fine as-is."
- The previewed action must be visually marked as a preview on the home page, not indistinguishable from a real todo.
- Comments and likes on the action are blocked during preview, same as the participation writes.
- Dismiss (removing the action from one's own todo list without completing it) is refused during preview, same as complete/withdraw.
- The preview-active check must be computed live on every read (toggle state vs. now vs. `member_action` start) — no stored "is active" flag that a background job clears with a lag.
- A share-code link generated during preview still enforces staff-only visibility when opened: a non-staff/non-admin visitor following the link gets the normal "not available yet" experience, not early access to the pre-launch action.
