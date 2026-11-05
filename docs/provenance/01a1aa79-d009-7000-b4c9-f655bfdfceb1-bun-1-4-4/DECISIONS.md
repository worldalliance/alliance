# Decisions

- Bun 1.4.4 stores `process.env.X = undefined` as the string `"undefined"`, as Node does; 1.3.6 kept it `undefined`. `common/src/set-env.ts` `setEnv` deletes the key for `undefined`, so tests can restore a variable that was unset. (agent decision)
- Every test restore that could receive `undefined` goes through `setEnv`, including the hand-rolled delete-or-assign blocks it replaces. Restoring an unset variable by assignment leaked `"undefined"` into later tests on 1.4.4: admin's `HostedDocsPage` read `VITE_ALT_APP_URL` as an invalid URL, and server tests after `action-update-email.spec.ts` read `ALT_APP_URL` the same way. (agent decision)
