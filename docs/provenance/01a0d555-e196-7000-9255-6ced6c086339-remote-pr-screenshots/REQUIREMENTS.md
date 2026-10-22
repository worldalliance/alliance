---
user: Charles Lien
task: Run the PR screenshots agent remotely instead of locally
---

## User request

- Make the `pr-screenshots` skill (an agent that captures before/after screenshots or videos of the journeys a branch changes and posts them as one PR comment) run remotely: "either gh actions or aws or something". Supporting one platform is enough.
- The user raised a concern: since the repo is open source, running agents on GitHub Actions may be a security risk.
- The agent should be able to use an Android emulator "if it would like to". Android emulators were not working on GitHub Actions at all before this.
- iOS "would be nice", though the user expected there were no good options.

## Dropping iOS

- The user said `mobile-visual-regression-ios.yaml` doesn't currently run and the engineer who built it has left, so it counts as untested/experimental. The user's decision: "let's drop the ios".

## Test run

- Create a temporary PR with a few UI changes, covering both web and mobile.
- Manually trigger a workflow that runs `claude -p --dangerously-skip-permissions --output-format stream-json` with a general prompt like the `pr-screenshots` skill's.
- Remove the `pr-screenshots` skill afterward.
- After the first successful capture, the user asked to try again with "a substantial change that the agent would actually look at", such as an animation.

## Posting token

- The user asked whether the runner could use its own GitHub token, and how to attach it.
- The user created a PAT and stored it as the repo secret `PR_SCREENSHOTS_GH_TOKEN`. After it was rejected, the user updated the token. The user then made the organization the owner of the PAT, and posting worked.

## Approval of agent proposals

The user said "yes" to this agent-authored list of changes, to be put on a clean branch off `main` holding only the workflow and prompt:

- Check that whoever adds the label has write access.
- Have the agent use a dedicated Anthropic API key with a spend limit instead of the shared `CLAUDE_CODE_OAUTH_TOKEN`.
- Cache the Android build, keyed on the mobile fingerprint.
- Hide the Expo dev-client floating gear button in captures.
- Delete `skills/pr-screenshots/`, drop the test UI changes, and close the temporary PR #203.

## Follow-up

- The user asked that the agent use "the same api key as the commit review workflow" (`code-review.yaml`, which uses the `CLAUDE_CODE_OAUTH_TOKEN` secret). This supersedes the approved dedicated-key item above.
