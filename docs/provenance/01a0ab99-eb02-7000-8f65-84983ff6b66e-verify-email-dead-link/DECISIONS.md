---
agent: Claude Opus 5
---

## 400 for an expired, malformed, or wrong-type token

A 401 means the session is bad, and the web client acts on it by refreshing and signing the member out. A token in the request body is input, so any token `verifyEmail` rejects gets a 400. The wrong-type case moves to 400 with the others, and so does a token for a user who no longer exists (a 404 before), so a client has one status to branch on.

## Page states

`VerifyEmailPage` tracks `Verifying`, `Verified`, `DeadLink`, and `Failed`. A missing token and a 400 both show the dead-link message. Any other failure (a 500, or the request not reaching the server) shows a message to try the link again, since the link itself may be fine.

## No resend

The server has no endpoint to resend the verification email, so the page does not offer one.
