# Decisions

## What exists (reconstructed from existing code)

- `ActionTaskKind.KoraReview` actions render `KoraActionTask` (web `apps/frontend/src/components/KoraActionTask.tsx`, mobile `apps/mobile/components/KoraActionTask.tsx`) in place of a form. Web links to `KORA_REVIEW_PATH`; mobile pushes `/kora-review`, a WebView signed in with a single-use web handoff code.
- `KoraActionListener` completes every non-archived Kora action for a member when a non-`extra` assignment completes, and `KoraReviewService.assign` marks every assignment after a member's first completed one `extra`. So only the first Kora action a member worked on could ever complete.

## Data

- **An assignment belongs to the action it was started from.** `kora_assignment.actionId` is nullable, with a unique index on (`reviewerId`, `actionId`) among live rows, and is set null if the action is deleted. `GET /actions/:id/kora-review` (`KoraActionReviewController`) creates or resumes that action's assignment for the member, never `extra`. Assignments started from the Kora project's review page keep today's `extra` rule and complete no action. Completing an action-bound assignment emits `KORA_ACTION_REVIEWED` with its action, and `KoraActionListener` completes only that action. If a member has two open Kora actions (a missed one still open), each gets its own assignment. Rationale: the requirement that each action's task counts alone. (agent decision)
- **Starting checks completion first.** The endpoint refuses a non-Kora action (404) and runs `ensureCompletionAllowed` before starting an assignment, so a member outside the cohort or past the deadline can't start one. (agent decision)
- **Exit survey after each action.** Action-bound assignments aren't `extra`, so the tool asks its exit survey after each one. It is KORA's per-session feedback, which fits a recurring session. (agent decision)
- **Active time is stored on the assignment** as a running total of seconds, so it survives reloads and moving between phone and web. (agent decision)
- **One step, no backward compatibility.** The change replaces the first-assignment rule outright, with no `BACKCOMPAT` fallback for assignments without `actionId`, since no member Kora actions or KORA data exist in production (see REQUIREMENTS.md). (agent decision)

## Active time

- The user deferred what counts as active. Recommendation: time counts while the review is visible (`document.visibilityState`, and the app in the foreground on mobile) and the member scrolled, tapped, clicked or typed within the last 2 minutes. The host page counts it, not the review tool: `createActiveTimeCounter` (`apps/frontend/src/lib/koraActiveTime.ts`) ticks each second, listening for input on the window, and `useKoraActiveTime` posts every 30 counted seconds (and on hiding or leaving) to `POST /kora/review/assignments/:id/active-time`. That leaves `kora-review` making no network requests. The server credits each report at most 60 seconds and at most the wall-clock time since the previous report (`kora-active-time.ts`), so a client can't inflate it. A failed report is logged and dropped; it only undercounts. Drop this for a simpler measure if it adds friction. (agent decision, user deferred how)
- **The time cap is reached, then the conversation finishes.** Once the active total is at least 15 minutes, the server completes the assignment on the first save that leaves no conversation pending. `next` then gives no further conversation, so the tool shows its finish screen. Known gap: if the member closes the page between finishing a conversation and the tool's `next` call, and the time is up when they return, the resume binds one more conversation before the task completes. The 15 minutes are a constant beside `transcriptsPerAssignment`, not an admin setting, until someone needs to change them. (agent decision)

## Embedding

- **A bare review route.** `/actions/:id/review` (`KoraActionReviewPage`, path from `koraActionReviewPath` in `common/src/kora.ts`) sits outside the app navbar layout. It shows only a "Back to the action" link above the tool, and mounts it through `KoraAssignmentReview`, which it shares with the project's review page. The mobile WebView loads that route through the handoff redirect (`next=`) when opened from "Start reviewing"; "Review more transcripts" still opens `KORA_REVIEW_PATH`. One view serves both, as the mobile requirement asks. (agent decision)
- **After finishing**, the route shows "Task complete" with the continue note and a "Review more transcripts" link to the project's review page, and it refetches the action. The action completes through an async event, so a refetch can still land before it; mobile refetches again on returning from the WebView. (agent decision)
- **Profile questions** the tool asks a reviewer the first time count toward active time like any other review screen. (agent decision)

## No conversations left

- The check runs on each visit to the action's review route. The endpoint completes the action as the member, through `ActionActivityService.completeAction`, whenever the action's state is `NoneLeft`: no open batch or no candidates, an assignment whose batch closed, or one finished with nothing in it, as when a retire empties it before any rating. A repeat completion is ignored. No new activity type, so streaks, suspension and stats need no changes. (agent decision, implementing the user-approved requirement)

## Code layout

- **Review service split.** `kora-review.service.ts` was at the 500-line limit. A codex subagent proposed moving the home page's read queries (`offer`, `progress`) out; they now live in `kora-home-queries.ts`, and the active-time arithmetic and write in `kora-active-time.ts`. (agent decision)
- **Regenerated client churn.** `ActionsModule` now imports `KoraModule`, which changes route registration order. So `shared/client/*.gen.ts` reorders widely, though the only new names are the two endpoints and `ReportKoraActiveTimeDto`. (agent decision)
- **`ActionDto` sends `taskKind`.** Its constructor never copied the field, so clients got none and `ActionTaskPanel` showed an empty form panel for a Kora action. Found while launching a demo action locally; fixed here because the action's review can't be reached without it. (agent decision)

## Staging demo

- **The pool can run dry.** `candidates` in `server/src/kora/kora-pool.ts` offers a conversation only while its reviews are under the batch's `reviewsPerTranscript`. A member is never given one they've already had. So on staging the 88 test conversations support about `88 × reviewsPerTranscript` reviews in all. Once that is reached, every remaining member who opens the task gets the "No conversations to review right now" completion. Before the demo, set the batch's `reviewsPerTranscript` high enough for the cohort, or demo with few members. (agent assumption, reconstructed from existing code)

## Out of scope

- Automatic creation or repetition of actions; admins duplicate the previous Kora review action.
- A new form element type for embedding the review in task forms.
- Showing minutes to the member.
- Admin checks that an open batch has enough conversations for a cohort before launch.
