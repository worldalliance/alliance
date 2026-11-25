# Decisions

- The flake is a real race in `TextComposer`, not a test defect, so the fix goes in the component. A passive `useEffect` focused "Send anyway" when the warning appeared; a click landing before that effect ran had its textarea focus overridden by the stale effect, and the re-render then unmounted the focused button, dropping focus to `<body>`. Evidence: the `MutationObserver` reproduction in EVIDENCE.md. (agent decision)
- Focus "Send anyway" in `useLayoutEffect`, which runs inside the commit, so no event can land before the button has focus. React recommends layout effects for DOM work that must happen before the browser paints. (agent decision)
