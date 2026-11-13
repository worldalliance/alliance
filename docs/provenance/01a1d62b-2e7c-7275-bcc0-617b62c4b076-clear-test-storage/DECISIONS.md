# Decisions

- Storage is cleared after every test in the shared preload (`shared/lib/testing/preload.ts`), next to its other cross-file resets (spies, `navigator.clipboard`, timers), rather than in `OnboardingPage.test.tsx` alone, since any file that writes storage without cleaning up reaches every later file the same way (`EVIDENCE.md`, the failure). (agent decision)
