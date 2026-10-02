---
user: Charles Lien
task: Act on PostHog's notice to update self-managed nginx reverse proxies
---

## Context (PostHog, not the user)

PostHog emailed that its ingestion load balancers had used IPs from AWS's shared pool, which return to other AWS customers when a node rotates. nginx resolves an upstream name once at startup and skips upstream certificate checks by default, so a long-running proxy can keep sending events to an IP PostHog no longer holds. Its requested action: verify the upstream certificate and re-resolve DNS, per https://posthog.com/docs/advanced/proxy/nginx.

## Stated by the user

Do what needs to be done, let me know if you need anything that can't be done through codebase changes
