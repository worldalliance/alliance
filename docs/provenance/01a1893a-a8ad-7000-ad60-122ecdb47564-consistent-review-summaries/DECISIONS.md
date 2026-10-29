# Decisions

- Summarize every nonempty set of reviews, including when only one reviewer completes, so notification contents do not depend on how many reviewers succeed.
- On request or JSON parsing failure, emit a workflow warning and use the existing full-report fallback. The reviewer's notification decision still controls whether to send the notice.
- Limit the summary request to 120 seconds, including at most 10 seconds to connect, so a stalled service reaches the full-report fallback instead of consuming the job timeout.
