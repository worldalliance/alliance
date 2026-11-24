# Evidence

## Reproduction

Method: a test clicks "Send anyway" from a `MutationObserver` callback as soon as the button is in the DOM. The callback runs after React's commit and before its passive effects flush. On origin/main at 33372dfca2, with React 19.2.3 and bun 1.3.14, it failed 3 of 3 runs with `document.activeElement` being `<body>`, the same as the CI failure in https://github.com/worldalliance/alliance/actions/runs/45303684940/job/138142166570 (2026-11-24).
