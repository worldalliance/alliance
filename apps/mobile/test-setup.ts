// Metro defines this and bun doesn't. It runs as a preload, rather than per
// test file, because `bun test` shares one `globalThis` across the run: a file
// that set it would leak it into every file after it and no others.
Object.assign(globalThis, { __DEV__: true });
