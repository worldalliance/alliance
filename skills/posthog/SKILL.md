---
name: posthog
description: Read before pulling PostHog session replays or other data from the PostHog API.
---

# PostHog API

`POSTHOG_API_KEY` in `.env.devtools` is a personal API key that reads session recordings in one project, on US cloud: `https://us.posthog.com/api/projects/@current/`.

PostHog gives every tab in a browser one session ID, and the replay player interleaves their windows. Group snapshots by window ID before reading a timeline.
