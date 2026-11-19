# Evidence

Checked 2026-11-18 by a research subagent; statuses per root `AGENTS.md` **Established practice**.

## Slack message formatting

- Mobile push notifications use only a message's `text`; desktop notifications prefer text in blocks. Links are `<url|label>`; only `&`, `<` and `>` are escaped. User mentions `<@U…>` notify only channel members; `@here`/`@channel` should be used sparingly. Vendor recommendation: [Slack, formatting message text](https://docs.slack.dev/messaging/formatting-message-text).
- `text` is recommended alongside blocks, since screen readers read it; text over ~4,000 characters may be split. Vendor recommendation: [Slack, chat.postMessage](https://docs.slack.dev/reference/methods/chat.postMessage).
- Put essential details first and cut filler. Vendor recommendation: [Slack, app design](https://docs.slack.dev/surfaces/app-design/).
- Incoming webhooks return no message `ts`, so their messages can't be threaded under or edited. Vendor documentation: [Slack, incoming webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks).

## Structuring notification code

- Sentry defines each notification type's title, link, description and actions independently of the destination, and a separate Slack builder renders them with escaping and fallback text. Common practice (read in source): [notification base](https://github.com/getsentry/sentry/blob/master/src/sentry/notifications/notifications/base.py), [Slack builder](https://github.com/getsentry/sentry/blob/master/src/sentry/integrations/slack/message_builder/notifications/base.py).
- Knock and Novu keep one template per workflow (event type) per channel. Vendor documentation: [Knock](https://docs.knock.app/integrations/chat/slack/overview), [Novu](https://docs.novu.co/platform/integrations/chat).
- No vendor guidance was found on snapshot-testing message payloads; it is common practice for template functions.

## Actionable alerts

- An alert should be urgent and actionable; noisy alerts get ignored. Vendor recommendation: [Google SRE book, monitoring](https://sre.google/sre-book/monitoring-distributed-systems/).
- An alert needs a specific title, what is wrong and why it matters, and resolution steps or a runbook link. Vendor recommendation: [PagerDuty, alerting principles](https://docs.pagerduty.com/ops-guides/incident-response-guide/alerting-principles).
