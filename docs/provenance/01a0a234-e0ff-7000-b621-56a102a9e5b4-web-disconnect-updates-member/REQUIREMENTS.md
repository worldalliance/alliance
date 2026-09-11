---
user: Charles Lien
task: Apply review fixes to the commit that adds provider connect and disconnect to web settings
---

- Fix every must-fix finding, and every should-fix finding that the commit itself introduced.
- The agent's review found this should-fix: after a disconnect succeeds, AuthContext's `refreshUser` swallows an HTTP error from `/auth/me`. The provider row keeps offering "Disconnect" for a provider that is already gone, and no message appears.
- Also fix findings of any tier that only dedupe code, change no code (comments, commit messages), delete dead code, rename without changing behavior, or correct inaccurate copy.
- File pre-existing should-fix findings in Linear instead of fixing them, after checking they aren't already filed.
