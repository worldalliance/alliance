# Decisions

## Where each app's config module lives

- Shared helpers (empty-as-unset, required/optional/flag fields, an http(s) URL field, per-key reads, whole-schema parsing, the problem listing) are in `common/src/env.ts`, used by all three, and land in their own commit ahead of the server's. `parseEnv` parses each field on its own and then asks which keys the parsed values make required, rather than using a zod refinement on the object: zod skips an object's refinements once any field fails, so one bad key would hide every conditionally required one.

## Hand-rolled helpers rather than `@t3-oss/env-core`

`@t3-oss/env-core` is the widely used zod env-schema library, and it covers empty-as-unset and listing every problem. It doesn't fit three choices here: `createEnv` parses the whole environment once, while values here are read when used (below); its `emptyStringAsUndefined` deletes empty keys from the env object it is given, where these helpers never write to `process.env`; and a cross-field rule goes in its `createFinalSchema`, a schema over the whole object, which loses conditionally required keys the way a zod refinement does. What would remain of it is the field map these helpers already take.

## Per-key reads throw rather than return a `Result`

`readEnvKey`, `requireEnvKey` and each app's accessor throw naming the key, an exception to the `Result` rule in `AGENTS.md`. A value that fails there is misconfiguration, which should fail loudly where it is read, and every caller would unwrap a `Result` into the same throw. `parseEnv`, whose problem list a startup or build check reports, returns a `Result`.

## Values are read when used, not parsed once at import

About 20 server spec files, and some web and mobile tests, set `process.env` mid-test and expect the code to see it. Each accessor parses its one key on every call; the whole schema is checked once at startup or build. Parsing one small zod schema per read is cheap next to anything that reads config.

## An empty value is unset

The deploy writes `export KEY=${{ secrets.X }}`, which expands a secret that was never set to `KEY=`. A whitespace-only value, which no key can use, reads as unset too, and so does a required value its transform leaves empty, such as a list set to `,`: one rule for missing, whichever helper reads the key.

## Smaller choices

- `oauth.controller.ts` was past the 500-line limit, so it was split first, in its own commit, along the lines a read-only codex subagent recommended: callback handling into `OAuthCallbackService`, shared session helpers into `OAuthSessionService`, the proof cookie into `oauth-browser-proof.ts`, with routes, decorators and class/method names unchanged.
