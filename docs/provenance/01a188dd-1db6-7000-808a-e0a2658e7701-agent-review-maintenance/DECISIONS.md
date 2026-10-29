# Decisions

- Both automatic reviewers read `.github/commit-review/prompt.md`, which delegates review criteria and the report format to the same review skill used by manual review. The entry point describes its commit scope and unprepared headless environment.
- The workflow retains the repository instructions so manual and automatic reviews see the same project constraints. Complete reports and bounded notifications use the preceding report-output change.
- Codex uses the [read-only sandbox](https://learn.chatgpt.com/docs/github-action) to enforce the review-only checkout boundary. The newer `permission-profile` input is supported by the action but rejected by the current workflow linter; the supported `sandbox` input preserves compatibility.
- Full reports include incidental pre-existing follow-ups under the shared review criteria. The attention marker is limited to findings introduced or worsened by the reviewed commit, so unrelated defects do not trigger an author notification.
