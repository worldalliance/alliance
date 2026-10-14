# Progress page filter defaults

- With one or more priorities selected, filtering is unchanged: an item shows when any of its tags is selected.
- The empty-selection case lives in `matchesPriorities`, beside the rule it extends. That function sits in its own module, outside the route module, so a unit test can pin both rules.
- The "No matching projects." message stays. It still applies when the selected priorities match no item.
