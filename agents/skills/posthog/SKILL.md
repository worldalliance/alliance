---
name: posthog
description: Read before pulling PostHog data from its API, such as production errors (`$exception`), slow queries, traffic, web vitals or session replays.
---

# PostHog API

`POSTHOG_API_KEY` in `.env.devtools` is a personal API key that reads session recordings and runs HogQL queries in one project, on US cloud: `https://us.posthog.com/api/projects/@current/`. When it's missing, have the user create one in PostHog under Settings → User → Personal API keys, with scopes Session recording: Read and Query: Read on that project, and add it to `.env.devtools`. `scripts/with-secrets.sh` doesn't load that file; pass it with `bun --env-file=.env.devtools`.

The server sends its errors, request logs and other events from production only (`posthogClientIfEnabled` in `server/src/posthog/posthog-client.ts`), so a staging or development server error leaves no trace here. Mailgun webhook events are the exception: whichever non-test server receives one sends it for mail tagged `production`.

The admin panel's deployed builds send their events into the same project as the member site, each tagged `app: admin`, with URLs replaced by route templates such as `/forms/:formId`. Member-site events carry no `app`, so exclude admin with `coalesce(properties.app, '') != 'admin'`.

PostHog gives every tab in a browser one session ID, and the replay player interleaves their windows. Group snapshots by window ID before reading a timeline.
