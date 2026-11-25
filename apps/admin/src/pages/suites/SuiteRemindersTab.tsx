import type { ActionSuiteDto } from "@alliance/shared/client";
import { milliseconds } from "date-fns";
import { useEffect, useState } from "react";
import ActionRemindersTab from "../../components/reminders/ActionRemindersTab";

/**
 * The suite's reminders. `highlightedReminder`, from the URL, is scrolled to
 * and outlined for two seconds, as the timeline's reminder links ask.
 */
export function SuiteRemindersTab({
  suite,
  highlightedReminder,
}: {
  suite: ActionSuiteDto;
  highlightedReminder: number | null;
}) {
  const [shown, setShown] = useState(highlightedReminder);
  useEffect(() => {
    setShown(highlightedReminder);
    if (highlightedReminder === null) return;
    const timer = setTimeout(
      () => setShown(null),
      milliseconds({ seconds: 2 }),
    );
    return () => clearTimeout(timer);
  }, [highlightedReminder]);
  return (
    <ActionRemindersTab
      suite={suite}
      highlightedReminder={shown ?? undefined}
    />
  );
}
