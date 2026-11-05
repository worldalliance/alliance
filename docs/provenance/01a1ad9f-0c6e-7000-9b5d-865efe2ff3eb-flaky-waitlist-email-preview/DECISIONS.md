# Decisions

- Tests whose next step depends on the preview first wait for the debounced preview request to show up in `api.previews`, with a 3 s timeout, and only then assert on preview text at the default 1 s. The 400 ms draft debounce in `EmailComposer` no longer eats into the assertion's budget. (agent decision; option two of ALL-2060)
- Fake timers are rejected. The API mock answers over real IO, and while fake timers run, Testing Library advances fake time inside `waitFor`, so its timeout would run out in fake time before a real response arrived. (agent decision)
- The resend test waits for "Send email" to be enabled before each click. A failed send triggers a new preview, and the button stays disabled until that preview lands; the sibling "keeps a failed send's request id" test already waited this way. (agent decision)
- Verified by delaying the mock preview response by 700 ms: before the change 16 of 21 tests failed, after it all 21 pass. Unloaded and CPU-loaded runs never reproduced the flake on the development machine. (agent decision)
