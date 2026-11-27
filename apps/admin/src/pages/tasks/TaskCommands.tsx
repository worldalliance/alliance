import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { stepPath } from "../../components/ProjectStepRows";
import { suiteHref } from "../../lib/hrefs";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { ButtonVariant, buttonVariants } from "../../ui/Button";
import { cn } from "../../ui/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/DropdownMenu";
import NewTabMark from "../../ui/NewTabMark";
import { imageUploadingMessage } from "../action-dashboard/actionSaveErrors";
import type { useActionCommands } from "../action-dashboard/useActionCommands";
import type { ActionExport } from "../action-dashboard/useActionExport";
import { ExportTaskDialog } from "./ExportTaskDialog";
import { duplicateConsequence } from "./taskFacts";

export const UNSAVED_DUPLICATE_REASON = "Save your changes on Details first.";

/** The record's header actions: the member page, then the rest under "More". */
export function TaskCommands({
  task,
  commands,
  actionExport,
  imageUploading,
  unsaved,
  memberPageUrl,
}: {
  task: ParsedActionDto;
  commands: ReturnType<typeof useActionCommands>;
  actionExport: ActionExport;
  imageUploading: boolean;
  /** The Details tab holds edits not yet saved; a copy would leave them out. */
  unsaved: boolean;
  memberPageUrl: string;
}) {
  const confirm = useConfirmOnPage();
  const [running, setRunning] = useState(false);
  const duplicateBlocked = imageUploading
    ? imageUploadingMessage
    : unsaved
      ? UNSAVED_DUPLICATE_REASON
      : null;

  const run = async (command: () => Promise<void>) => {
    setRunning(true);
    await command();
    setRunning(false);
  };

  const duplicate = async () => {
    const confirmed = await confirm({
      title: "Duplicate this task?",
      message: duplicateConsequence(task),
      confirmLabel: "Duplicate task",
    });
    if (confirmed) await run(commands.handleDuplicate);
  };

  return (
    <>
      <a
        href={memberPageUrl}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "inline-flex",
          buttonVariants({ variant: ButtonVariant.Default, size: "medium" }),
        )}
      >
        View member page
        <NewTabMark />
      </a>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-busy={running || undefined}
          className={cn(
            "inline-flex",
            buttonVariants({ variant: ButtonVariant.Default, size: "medium" }),
          )}
        >
          {running && (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          )}
          More
          <ChevronDown aria-hidden="true" className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem
            disabled={duplicateBlocked !== null || running}
            onClick={() => void duplicate()}
            className="flex-col items-start gap-0"
          >
            Duplicate task…
            {duplicateBlocked && (
              <span className="text-caption text-fg-muted">
                {duplicateBlocked}
              </span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => void actionExport.handleExportActionOpen()}
          >
            Export JSON…
          </DropdownMenuItem>
          {(task.suite || task.project) && <DropdownMenuSeparator />}
          {task.suite && (
            <DropdownMenuItem render={<Link to={suiteHref(task.suite.id)} />}>
              Open suite
            </DropdownMenuItem>
          )}
          {task.project && (
            <DropdownMenuItem render={<Link to={stepPath(task)} />}>
              Open in project
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={running}
            onClick={() => void run(commands.handleArchive)}
          >
            {task.archived ? "Unarchive task…" : "Archive task…"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {actionExport.exportActionOpen && (
        <ExportTaskDialog actionExport={actionExport} />
      )}
    </>
  );
}
