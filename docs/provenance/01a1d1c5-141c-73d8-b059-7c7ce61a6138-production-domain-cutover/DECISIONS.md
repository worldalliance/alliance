# Decisions

The user asked for ALL-2140 as filed and was not asked about each of its points. They come from `01a1ccef-8e76-75bb-9655-d39c48ef9c28-finish-thealliance-move` and the mechanism from `01a1ce3b-28ec-7672-900a-c9fc06dca218-staging-domain-cutover`, and are followed in full unless an entry below says otherwise.

- Production's `DOMAIN_NAME` becomes `thealliance.org` and `ALT_DOMAIN_NAME` `worldalliance.org`, the swap the staging task made the whole config change. (forwarded source)
- For ALL-2138, the production Twilio account's Alliance number had its SMS webhook moved from `https://worldalliance.org/api/mms/inbound` to `https://thealliance.org/api/mms/inbound` through the Twilio API with the local server credentials. No number points at staging. Mailgun was left unchanged: the user found both sending domains' webhooks already on `https://thealliance.org/api/mailgun/handle-event` (EVIDENCE.md, Mailgun webhook configuration), so another engineer had moved them before this task. The repository holds only the Mailgun signing key, not an API key. (agent action)
