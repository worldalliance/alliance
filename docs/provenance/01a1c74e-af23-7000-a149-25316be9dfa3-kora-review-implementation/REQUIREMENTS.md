---
user: Alex Dorey
task: Continue implementing the Kora scenarios in a single PR
---

This task implements the rest of the spec in `docs/provenance/01a1c67a-0156-7000-a694-8fc78b1dd41b-kora-review-section-spec`, after the project status in `docs/provenance/01a1c68b-9d69-7000-8f68-531e4690561e-kora-project-status`. It changes some of that spec's requirements, which are marked below.

## Delivery

- Every remaining scenario is implemented on `alex/kora-personas-and-status`, which becomes one PR. Nothing merges to `main` yet. (user)

## The review tool in this repo

- KORA's review tool comes into this repository, and it may be modified here. (user)
- It's copied as plain source from `korabench-review` v0.1.0-alpha.0 (`github.com/worldalliance/korabench-review`), with the source repository and tag recorded here and no imported history. (agent-proposed, user-approved)
- It lives at `kora-review/` as the workspace package `@alliance/kora-review`. This replaces the spec's install from a GitHub tag (R2 in the review-section spec). (agent-proposed, user-approved)
- Its tests run under `bun test`, like every other package's. (agent-proposed, user-approved)
- The transcript converter becomes a function the server calls on upload. (agent-proposed, user-approved)
- `kora-review/src/engine.ts`, the tool's core, stays unchecked (`@ts-nocheck`) for now. Once the scenario work is done, it gets typed and split into files under the 500-line limit. (user)

## Closed project

- When the project is Closed, returning participants can still sign in, but the server refuses new participant sign-ups. (agent-proposed, user-approved)

## Notify waitlist

- "Notify waitlist" reaches non-member participants only, once each. A later send reaches only those who signed up since the last one. Members are reached through their action. (agent-proposed, user-approved)
- Launch email subject: "Safer Chatbots for Children: reviews are open". Body: "The reviews you signed up for are ready. It takes about an hour, and you can stop and pick up where you left off. Start reviewing: {link}". SMS: "Alliance: the Safer Chatbots for Children reviews are open. Start here: {link}" (agent-proposed, user-approved)

## Assignments

- Only finished reviews count toward a transcript's review target. An assignment untouched for 7 days releases its unreviewed transcripts back to the pool. A reviewer who returns later can still save, and their reviews still count. (agent-proposed, user-approved)

## Review page

- Someone who opens `/projects/safer-chatbots-for-children/review` while signed out goes to the project page to sign in, then returns to the review page. If the project isn't Active, they go to the project page. (agent-proposed, user-approved)
- A member who opens the review page directly gets the same assignment as through their action, and finishing it completes the action. (agent-proposed, user-approved)
- The user will write the thank-you copy. Until then it uses placeholders. (user)
