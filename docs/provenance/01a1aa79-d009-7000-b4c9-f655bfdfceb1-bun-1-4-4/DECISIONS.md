# Decisions

- Bun 1.4.4 stores `process.env.X = undefined` as the string `"undefined"`, as Node does; 1.3.6 kept it `undefined`. `common/src/set-env.ts` `setEnv` deletes the key for `undefined`, so tests can restore a variable that was unset. (agent decision)
