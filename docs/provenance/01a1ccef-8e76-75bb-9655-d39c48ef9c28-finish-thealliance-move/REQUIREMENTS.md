---
user: Charles Lien
task: Spec the remaining steps of the move from worldalliance.org to thealliance.org, and track them as a Linear project
---

- The remaining work is one Linear project whose issues are distinct PRs (or manual steps) linked by blocking relations into a DAG. There are no phases. (user-originated)
- Every expand-migrate-contract step the move needs is its own issue in that project, contract steps included, each blocked on the condition that allows it. (user-originated)
- After the web cutover, document loads on the legacy hosts redirect with a temporary `302` to the same path on thealliance.org. A later issue makes them a permanent `301`. (agent-proposed, user-approved)
- The mobile app's production and staging API and analytics hosts move to thealliance.org through an OTA update and the next binary. The legacy API keeps serving until no traffic comes from builds older than that change. (agent-proposed, user-approved)
- `contact@`, `support@` and `grant@thealliance.org` exist and receive mail. Every address the site shows moves to `@thealliance.org`; the `@worldalliance.org` addresses keep forwarding. This supersedes the requirement in `01a0ee10-f174-7000-8934-8a513cfc2dbd-links-follow-current-domain` to leave the addresses as they were. (agent-proposed, user-approved; mailbox existence user-stated)
- worldalliance.org links stored in content authored on the site are rewritten to thealliance.org by expand-migrate-contract. Members' email addresses and messages are never rewritten. (agent-proposed, user-approved)
- The cutover stops writing `switchedDomainAt` and keeps the column and the `SwitchedDomainAt` user property, so saved form conditions that use it keep working. Removing them is separate expand-migrate-contract work in the project. (agent-proposed, user-approved)
- The Twilio signature check accepts both the legacy and the new webhook URL during the move. The Twilio, Mailgun and OAuth console changes are listed as manual issues. (agent-proposed, user-approved)
- Staging cuts over first, as a rehearsal, and production's cutover is blocked on it. (agent-proposed, user-approved)
- worldalliance.org stays registered and redirecting indefinitely. The project's last contract steps remove the code exceptions (the legacy API host, legacy CORS origins, legacy `/.well-known/` serving), not the domain. (agent-proposed, user-approved)
