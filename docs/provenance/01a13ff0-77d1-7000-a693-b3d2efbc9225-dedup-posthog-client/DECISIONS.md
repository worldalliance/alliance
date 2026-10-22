# Decisions

## Production-only is the server's enable rule

`server/src/posthog/posthog-client.ts` owns the client config (`newPosthogClient`) and the enable rule (`posthogClientIfEnabled`, a `Record<NodeEnv, boolean>` that is true only for production). `PosthogService` and `main.ts` already used that rule. `AppTypeOrmLogger` sent whenever `POSTHOG_KEY` was set. That guard came from 9d533a291 ("only create posthog client when key exists"), which kept the logger from throwing when no key is set, not from a wish to emit outside production. The production-only rule still avoids that crash everywhere but production, where deploys export the key. Staging deploys export `POSTHOG_KEY` too, so staging slow-query events stop.

## The Mailgun webhook keeps its own rule

The webhook sends in any env but `test`, filtered by the mail's `production` tag; it takes only the client config from `newPosthogClient`. That tag filter was added on the receiving side, which suggests one receiver gets mail from every environment, and nothing in the repo shows which server Mailgun calls. Applying the server-env rule there would silently stop production email analytics if that receiver is staging, so the webhook keeps its behavior, including its per-event `flush()`.

## `main.ts` and the TypeORM logger use the factory

`main.ts` builds the exception filter's client before the Nest app exists, and `AppTypeOrmLogger` is built by the TypeORM `DataSource` outside DI, so both call the factory instead of injecting `PosthogService`.
