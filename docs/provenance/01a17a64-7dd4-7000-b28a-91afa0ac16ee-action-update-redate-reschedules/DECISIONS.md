# Decisions

- A scheduled update re-dated into the past publishes immediately, not at the past date: the publish time is the later of now and the new date, the same rule the first body save uses.
- The rule covers an update hidden by "Unpublish until displayed date" too: its hidden time is its date, so a re-date moves it like any other schedule.
- An update already visible to members stays visible when its date moves later. Hiding it again stays the explicit "Unpublish until displayed date" action, since members may already have seen it.
- Queued notifications are re-timed on every date edit, published or not, to `actionUpdateEntrySendTime`, the rule that set them at send time. One `retimeActionUpdateEntries` serves both this and unpublishing, which moves them to the same time.
- Recognition-mode updates need no entry re-time: their entries are created once `prepareDue` finds the update due, reading `date` and `visibleAt` from the row. Only legacy-mode updates queue entries ahead.
