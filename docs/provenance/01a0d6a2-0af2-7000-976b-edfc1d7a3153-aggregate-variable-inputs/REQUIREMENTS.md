---
user: Charles Lien
task: Specify aggregate variable inputs for multiselect answer counts
---

## User-origin requirements

- Add an aggregate input to form variables. The motivating action has roughly 100 companies: choosing a company should let text elsewhere include how many members selected it in an earlier action's multiselect.
- Return all option counts from an input.
- Count distinct members and use only each member's latest submission.
- Exclude responses saved through withdrawal. The user suspects duplicate writes around withdrawal and requested a separate Linear bug; fixing those writes stays outside this feature.
- Assume source options do not change. Prioritize code simplicity; behavior after option changes may be undefined.
- This task specifies the feature; implementation waits for a separate request.

## User-approved agent proposals

These behaviors originated with the agent and were approved during the interview:

- Exclude guests and drafts from the counted population.
- Support web and mobile forms, reopening completed forms, and admin previews/reviews. Feed cards and shared response summaries remain outside scope.
- Include eligible submitted answers regardless of answer-publicity settings. Expose only totals for aggregate inputs configured by an admin in a destination form the viewer can access. Guests accessing that destination receive the same totals.
- Fetch current totals when the destination opens; keep them stable while it remains open. Reloading or reopening refreshes them. Completed forms show current totals rather than preserving the totals seen at submission.
- Block a live form when required aggregates fail to load or become invalid. Offer retry for loading failures. Prevent saving broken aggregate references and deleting a source form while another current form depends on it. A failure must not appear as zero.
- Add an “Aggregate counts” input type with source-form and question selection. Retain the formula editor and editable sample counts for zero, one, and many members.
- Company-specific blurbs and filtering dropdown choices are separate features.

The user initially accepted the proposed option-edit semantics, then explicitly allowed undefined behavior for that case; the simplicity constraint above governs.
