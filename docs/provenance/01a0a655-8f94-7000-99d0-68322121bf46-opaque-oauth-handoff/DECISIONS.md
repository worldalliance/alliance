# Decisions

## The handoff is a random id, and what it stands for stays in server memory

The callback deep-links the handoff on `alliance://auth/oauth`, which any app registered for the scheme can read. A link handoff has to carry the provider profile to `/link`, and a signed JWT would put the member's email, name and subject in that URL for anyone to decode. The codebase already keeps the Apple name out of URLs for the same reason. So the handoff is 32 random bytes, and `OAuthAuthService.pendingHandoffs` maps it to the user id, proof hash, purpose and expiry.

Spending deletes the entry, which is what makes a handoff one-shot. A wrong proof leaves the entry in place, so an app that read the deep link can't burn the member's handoff.

The map relies on the server running as one process, which it does under pm2. A restart drops handoffs still in flight. Each lives two minutes, and the member retries sign-in.

Rejected: encrypting the JWT as a JWE. It keeps the token stateless but still needs a spent set in memory to stop a second use, so it adds a key and a format without removing the map.

Rejected: a database table. It survives restarts and a second instance, which the deploy doesn't have, at the cost of a migration and a cleanup job for two-minute rows.

## The e2e test decodes every segment of the handoff

`keeps the profile out of the deep link` splits the handoff on `.` and base64url-decodes each part before looking for the email. A plain `not.toContain` on the URL passes for a JWT too, since base64 hides the email. The test fails against the signed-JWT handoff and passes against the random id.

## Names

`issueHandoff`, not `signHandoff`, and `OAuthHandoff.userId`, not `sub`. The handoff isn't a JWT, so nothing gets signed and there are no claims.
