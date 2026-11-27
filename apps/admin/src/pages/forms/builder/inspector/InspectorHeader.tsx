import { withCount } from "@alliance/common/plural";
import { ButtonVariant, buttonVariants } from "../../../../ui/Button";
import { cn } from "../../../../ui/cn";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../../ui/Popover";
import { PaneHeader } from "../../../../ui/templates/Workspace";
import { useBuilder } from "../BuilderContext";
import { selectionIssues } from "../issues/IssueList";
import { HEADER_TRUNCATES } from "../paneHeader";
import { ElementActionsMenu } from "./ElementActionsMenu";
import { useSelectionActions } from "./useSelectionActions";

/** The selection's issues behind a button, taking no room when there are none. */
function IssuesHere() {
  const { issueIndex, canvas } = useBuilder();
  const messages = selectionIssues({
    index: issueIndex,
    page: canvas.currentPage,
    pageIndex: canvas.selectedPageIndex,
    target: canvas.resolvedTarget,
  });
  const count = withCount(messages.length, "issue");
  if (messages.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`${count} here`}
        className={cn(
          buttonVariants({ variant: ButtonVariant.Ghost, size: "small" }),
          "text-danger",
        )}
      >
        {count}
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
  );
}

/**
 * The inspector's title row: the selection's name, its issues and its
 * actions, one line high whatever is selected.
 */
export function InspectorHeader({ title }: { title: string }) {
  const actions = useSelectionActions();
  return (
    <PaneHeader
      title={title}
      className={cn(HEADER_TRUNCATES, "z-20 bg-canvas")}
      action={
        <div className="flex shrink-0 items-center gap-1">
          <IssuesHere />
          {actions && <ElementActionsMenu label={title} actions={actions} />}
        </div>
      }
    />
  );
}
