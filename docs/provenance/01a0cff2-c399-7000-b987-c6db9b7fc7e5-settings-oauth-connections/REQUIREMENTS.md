---
user: Charles Lien
task: Specify OAuth connections in mobile and web settings
---

## User-origin request

- "add oauth connection to the settings page in both mobile and web"
- The user invoked the spec skill: interview and write the spec; implementation requires a subsequent request.

## Approval of agent proposals

The user replied, "go with your recommendation for all," to nine agent-authored recommendations. The approved proposal context is listed below; the behavior and rationale are specified under the matching numbers in [DECISIONS.md](DECISIONS.md). These choices originated with the agent, rather than with the user's initial request.

1. Google and Apple connect/disconnect for every signed-in member on web, iOS, and Android; admin settings excluded.
2. An Account section with password controls and Connected accounts, showing provider icons, connected email addresses, and Connect/Disconnect buttons; separate Account from Privacy on mobile.
3. Allow a different provider email while preserving the Alliance email; reject another member's linked identity without merging accounts.
4. One account per provider, with disconnect required before switching accounts.
5. Confirm disconnect with the provider name; disable it for the last sign-in method and explain the alternatives.
6. Show Set password for members without a password and Reset password otherwise, using the existing email reset flow.
7. Native provider dialogs on mobile with browser fallback; provider redirects on web returning to the Account section.
8. Use the authenticated Alliance session without additional credential entry; require provider authentication for connection and preserve current and other active sessions.
9. Refresh connection status immediately, show inline success and actionable failures, return quietly on cancellation, allow retry, and complete pending web settings saves before redirecting, blocking departure on save failure.
