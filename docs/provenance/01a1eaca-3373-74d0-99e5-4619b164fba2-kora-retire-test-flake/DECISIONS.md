# Decisions

## Cause

The first reviewer's assignment takes `transcriptsPerAssignment` (4, from the newest batch B) transcripts at random from both batches' 8. When every transcript but the rated one comes from B, retiring B drops all the pending ones, `completeEmptied` completes the assignment, and the reviewer's next state carries no assignment, so the test's `kept` is empty. See `EVIDENCE.md`.

## Fix the test, not the service

Completing an assignment left with nothing to rate is intended behavior, covered by the next test in the file. The flaky test is meant to cover the other case, an assignment that keeps unrated work after the retire, so the fixture makes that case certain: A uploads 2 transcripts and B uploads 2, so the 4-transcript assignment always holds all of them, and the test rates the B one. The two A transcripts stay pending after the retire, and the rated-B branch the old conditional only sometimes exercised now always runs. (agent decision)
