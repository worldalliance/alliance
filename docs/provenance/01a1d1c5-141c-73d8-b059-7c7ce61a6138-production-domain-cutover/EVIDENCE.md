# Evidence

## Staging cutover, live

Method: `curl` from a workstation, 2026-11-12.

- `https://staging.worldalliance.org/actions` with `Sec-Fetch-Mode: navigate` returned `302` to `https://staging.thealliance.org/actions`; without browser headers it answered `200`. `https://admin.staging.worldalliance.org/` returned `302` to `https://admin.staging.thealliance.org/`, and `/.well-known/apple-app-site-association` on the legacy host answered `200`.

## Twilio webhook configuration

Method: Twilio REST API (`IncomingPhoneNumbers`, Messaging `Services`), 2026-11-12.

- The account's Alliance number posted inbound SMS to `https://worldalliance.org/api/mms/inbound`; its messaging service has `use_inbound_webhook_on_number` set, so the number's URL is the one Twilio calls. No other number points at either Alliance domain.
- Unsigned `POST`s to `/api/mms/inbound` on both domains answered `403`, showing the route and signature guard answer on `thealliance.org`. Each such probe also raises the guard's Slack alert; one did here. The account showed no inbound messages to the Alliance number that day, so no member message was rejected.
- After the move, the `POST IncomingPhoneNumbers/<sid>.json` that set the number's `SmsUrl` read it back as `https://thealliance.org/api/mms/inbound`, method `POST`.

## Mailgun webhook configuration

Method: the Mailgun dashboard, checked by the user, 2026-11-12.

- Both sending domains, `mailgun.worldalliance.org` and `mg.thealliance.org`, already had their webhooks on `https://thealliance.org/api/mailgun/handle-event` before this task, with none on `worldalliance.org`. Mailgun's "Test webhook" got `201` on each. Staging has no Mailgun webhook.
