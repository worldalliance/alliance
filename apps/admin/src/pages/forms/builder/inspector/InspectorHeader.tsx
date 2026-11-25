import { withCount } from "@alliance/common/plural";
import type { ReactNode } from "react";
import { selectionIssues } from "../../../../components/form-canvas/IssueList";
import { ButtonVariant, buttonVariants } from "../../../../ui/Button";
import { cn } from "../../../../ui/cn";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../../ui/Popover";
import { PaneHeader } from "../../../../ui/templates/Workspace";
import { useBuilder } from "../BuilderContext";
import { ElementActionsMenu } from "./ElementActionsMenu";
import { useSelectionActions } from "./useSelectionActions";

/** The selection's issues behind a button of fixed width, so the settings under it never move. */
function IssuesHere() {
  const { issueIndex, canvas } = useBuilder();
  const messages = selectionIssues({
    index: issueIndex,
    page: canvas.currentPage,
    pageIndex: canvas.selectedPageIndex,
    target: canvas.resolvedTarget,
  });
  const count = withCount(messages.length, "issue");
  return (
    <div className="w-20 shrink-0">
      {messages.length > 0 && (
        <Popover>
          <PopoverTrigger
            aria-label={`${count} here`}
            className={cn(
              "inline-flex max-w-full text-danger",
              buttonVariants({ variant: ButtonVariant.Ghost, size: "small" }),
            )}
          >
            <span className="truncate">{count}</span>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <ul
              aria-label="Issues here"
              className="flex list-disc flex-col gap-1 pl-4 text-danger"
            >
              {messages.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

/**
 * The inspector's title row: the selection's name, its issues and its
 * actions, one line high whatever is selected.
 */
export function InspectorHeader({
  title,
  extra,
}: {
  title: string;
  /** Controls the selection's own settings still put here. */
  extra?: ReactNode;
}) {
  const actions = useSelectionActions();
  return (
    <PaneHeader
      title={title}
      className="z-20 bg-canvas"
      action={
        <div className="flex shrink-0 items-center gap-1">
          {extra}
          <IssuesHere />
          {actions && <ElementActionsMenu label={title} actions={actions} />}
        </div>
      }
    />
  );
}
