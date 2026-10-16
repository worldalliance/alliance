import { actionsExportActionAdmin } from "@alliance/shared/client";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { milliseconds } from "date-fns";
import { useState } from "react";

export type ActionExport = ReturnType<typeof useActionExport>;

export function useActionExport(actionId: number | null) {
  const { error: pushError } = useToast();

  const [exportActionOpen, setExportActionOpen] = useState(false);
  const [exportActionEvents, setExportActionEvents] = useState(false);
  const [exportActionTaskForm, setExportActionTaskForm] = useState(true);
  const [exportActionSuite, setExportActionSuite] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);

  const handleExportActionOpen = async () => {
    setExportActionOpen((prev) => !prev);
  };

  const handleExportAction = async () => {
    if (actionId) {
      // Handed over unresolved: Safari only allows the write inside the click.
      const copied = await copyToClipboard(
        actionsExportActionAdmin({
          path: { id: actionId },
          query: {
            events: exportActionEvents,
            reminders: false,
            taskForm: exportActionTaskForm,
            suite: exportActionSuite,
          },
        }).then((response) =>
          response.data
            ? JSON.stringify(response.data)
            : Promise.reject(new Error("action export failed")),
        ),
      );
      if (!copied) {
        pushError("Could not export the action JSON to the clipboard");
        return;
      }
      setJsonCopied(true);
      setTimeout(
        () => {
          setJsonCopied(false);
          setExportActionOpen(false);
        },
        milliseconds({ seconds: 2 }),
      );
    }
  };

  return {
    exportActionOpen,
    exportActionEvents,
    setExportActionEvents,
    exportActionTaskForm,
    setExportActionTaskForm,
    exportActionSuite,
    setExportActionSuite,
    jsonCopied,
    handleExportActionOpen,
    handleExportAction,
  };
}
