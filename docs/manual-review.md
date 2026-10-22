# Manual reviews

In GitHub Actions, select **Manual review → Run workflow**. The branch selector chooses the workflow and review instructions. `checkout_ref` independently chooses the source snapshot as a branch, tag, or full commit SHA, and `review_target` tells the agent which changes to inspect. `HEAD` refers to that initial source snapshot, even if the agent later checks out another commit.

Choose `review-base` for one commit reviewed against its parent, including whether it works as a standalone change. Choose `review` for a revision range or a description of the intended changes.

```sh
gh workflow run manual-review.yaml \
  -f checkout_ref=feature-branch \
  -f review_target=abc1234 \
  -f review_skill=review-base

gh workflow run manual-review.yaml \
  -f checkout_ref=feature-branch \
  -f review_target='Review the changes since origin/main to the invitation flow' \
  -f review_skill=review
```

The workflow uses the same `CLAUDE_CODE_OAUTH_TOKEN` repository secret as PR screenshots. Read the report in the run summary; download the `manual-review` artifact for the request, transcript, and, for base reviews, `findings.json`. Artifacts are retained for seven days. A successful run means the agent returned a report, not that it found no problems or completed every check; those judgments are in the report. Failed runs retain available artifacts for diagnosis.

The workflow must be on the default branch to appear for manual dispatch. Review targets must be available in this repository's fetched history; for a range, check out its tip. A `checkout_ref` on no branch or tag of this repository, such as a fork pull request, is refused, because the review runs its code alongside the Claude token. Only `checkout_ref` is checked; the agent is merely instructed to refuse such a `review_target`, so never name a fork pull request there. No comments or notifications are posted by this workflow.
