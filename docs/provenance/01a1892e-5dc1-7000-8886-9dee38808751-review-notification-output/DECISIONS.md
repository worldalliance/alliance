# Decisions

- Publish each complete automatic review in the workflow run summary so a concise notification can link to the evidence and verification limits.
- Slack section text has a [3,000-character limit](https://docs.slack.dev/reference/block-kit/blocks/section-block/). When the summary is empty or a notification including the author mention exceeds that limit, send a short notice with the existing run link instead of cutting through a finding or link.
- Establish report storage and bounded notifications before the shared review prompt starts producing longer reports.
