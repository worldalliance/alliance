---
user: Charles Lien
task: Main mobile invite QR opens the public homepage; invitation and waitlist confirmation memory are session-only
---

# Requirements

## User requirements

- Event attendees can scan a QR code, learn about the Alliance on the landing page, and choose to accept an invitation afterward.
- Change the destination only for newly generated main QR codes on the mobile app's Invites page. Saved or printed codes keep their destination.
- Retain both invitation context and waitlist confirmation only for the current session. Neither has persistent browser remembering. Add no cookie popup.
- The specification describes the current design, without superseded proposals or revision history.

## Approved agent proposals

These product choices were proposed by the agent and approved by the user.

1. Keep the existing homepage content, add "Accept invite," and show the inviter's identity in signup rather than adding a personalized homepage introduction.
2. Make the invitation accessible throughout public-site navigation, including People, Guide, and Progress. General join buttons use it; the grantmaking announcement keeps its own destination.
3. Support valid personal referral codes, reusable invite links, and single-use invitations.
4. A newly opened valid invitation replaces the saved one. An explicit URL code has priority. An invalid explicit code neither overwrites the saved invitation nor silently substitutes it.
5. An invalid, deleted, used, or otherwise unavailable invitation leaves the explainer accessible, with "This invitation is no longer available" and the usual waitlist path. Invalid saved invitations are cleared.
6. A storage failure permits browsing and signup. Keep the invitation during navigation in the current tab and pass it into signup, without a blocking error; a later visit may require another scan.
7. An authenticated visitor sees the ordinary homepage and account navigation, without the invitation action. Scanning leaves session invitation state alone.
8. Add a small, clearly labeled dismissal control beside the invitation action. It forgets only the invitation and preserves waitlist state.
