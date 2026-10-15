---
user: Charles Lien
task: Route app-store review accounts to staging without affecting production users
---

# Requirements

## R1. Isolation and environment

Origin: user-originated.

Apple and Google reviewers must be able to exercise the app's features, including liking posts and comments and sending friend requests, without their new activity changing production users' notifications or displays. Reuse the existing staging environment for this activity.

## R2. Account designation

Origin: user-originated.

Designate review accounts with a user-table `isTestUser` column, managed through manual database edits. Add no admin UI for this field.

## R3. Sign-in

Origin: agent-proposed, user-approved.

Entering the designated account's email and password in the ordinary store app selects staging automatically. Apply this behavior to both iOS and Android and to sign-in on the production website. The website must take the reviewer into the staging website. Reviewers do not select an environment manually.

Use the existing review accounts and retain their email/password credentials through staging refreshes. Automatic staging entry uses email/password; routing through Apple or Google sign-in is outside this change. Those provider sign-in methods must not give designated accounts access to production. Account features used after staging entry follow normal staging behavior.

## R4. Nightly resets

Origin: agent-proposed, user-approved.

Keep the nightly production-to-staging refresh. Test activity may reset to the production snapshot each night. Restore the designated accounts' fixed review credentials as part of the refresh so the same credentials continue to work afterward. Preserving staging-only review activity across refreshes is outside scope.

## R5. Staging operation and content

Origin: user-originated.

Keep normal staging deployments during review. Use the data supplied by the production copy, with the existing staging anonymization. Add no sample friendships, conversations, incoming requests, or other review fixtures.

Keep staging's existing notification and delivery behavior. This feature must not introduce a separate policy disabling all email, SMS, and push delivery or a new review-only delivery allowlist.

## R6. Historical production activity

Origin: agent-proposed, user-approved.

Handle cleanup of the review accounts' existing production likes, posts, comments, friendships, and other activity separately. This change prevents subsequent review activity from affecting production; it does not remove historical activity.

## R7. Deliverable

Origin: user-originated.

Implement the specification in the application, schema, and staging sync. Account flagging, deployment, store-console updates, and production cleanup are outside this change.
