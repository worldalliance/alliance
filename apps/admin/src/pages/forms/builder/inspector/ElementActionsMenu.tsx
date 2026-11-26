import { ContextMenu } from "@base-ui/react/context-menu";
import type { ReactNode } from "react";
import { DropdownMenuContent } from "../../../../ui/DropdownMenu";
import {
  MoreMenu,
  type MoreMenuItem,
  MoreMenuItems,
} from "../../../../ui/MoreMenu";

/** What can be done to the selection. A null action is offered but unavailable; see each reason. */
export type ElementActions = {
  /** "page" reads "Move page up"; null reads "Move up". */
  moveNoun: string | null;
  onMoveUp: (() => void) | null;
  onMoveDown: (() => void) | null;
  /** False for a range or group, which has no up or down moves to offer. */
  offersMoves?: boolean;
  /** Null where the selection can't change pages: one page, or a display-only builder. */
  moveToPage: {
    pages: { index: number; title: string }[];
    onMove: (pageIndex: number) => void;
  } | null;
  /** "Duplicate" or "Copy page". */
  duplicateLabel: string;
  onDuplicate: (() => void) | null;
  onAddBelow: (() => void) | null;
  /** "Edit element JSON…" or "Edit page JSON…". */
  editJsonLabel: string;
  onEditJson: (() => void) | null;
  onShowInOutline: (() => void) | null;
  /** "Delete question", "Delete block", "Delete page" or "Delete section". */
  deleteLabel: string;
  onDelete: (() => void) | null;
  /** Why `onDelete` is null, as "A form needs at least one page". */
  deleteDisabledReason?: string;
};

export function actionItems(actions: ElementActions): MoreMenuItem[] {
  const move = actions.moveNoun ? `Move ${actions.moveNoun}` : "Move";
  const optional = (
    label: string,
    run: (() => void) | null,
    disabledReason?: string,
  ): MoreMenuItem[] =>
    run
      ? [{ label, onSelect: run }]
      : disabledReason
        ? [{ label, onSelect: () => {}, disabledReason }]
        : [];
  const moves = actions.offersMoves ?? true;
  return [
    ...optional(
      `${move} up`,
      actions.onMoveUp,
      moves ? "It's at the top." : undefined,
    ),
    ...optional(
      `${move} down`,
      actions.onMoveDown,
      moves ? "It's at the bottom." : undefined,
    ),
    ...(actions.moveToPage?.pages.map(({ index, title }) => ({
      label: `Move to page ${index + 1}: ${title}`,
      onSelect: () => actions.moveToPage?.onMove(index),
    })) ?? []),
    ...optional(actions.duplicateLabel, actions.onDuplicate),
    ...optional("Add element below…", actions.onAddBelow),
    ...optional(actions.editJsonLabel, actions.onEditJson),
    ...optional("Show in outline", actions.onShowInOutline),
    ...(actions.onDelete
      ? [
          {
            label: actions.deleteLabel,
            onSelect: actions.onDelete,
            destructive: true,
          },
        ]
      : actions.deleteDisabledReason
        ? [
            {
              label: actions.deleteLabel,
              onSelect: () => {},
              disabledReason: actions.deleteDisabledReason,
              destructive: true,
            },
          ]
        : []),
  ];
}

/**
 * The selection's actions: from a "More" button in the inspector header, or
 * as the context menu of `children` (right-click, Shift+F10 or the Menu key)
 * on an outline row or canvas element. Neither, with no action to offer.
 */
export function ElementActionsMenu({
  label,
  actions,
  trigger = "button",
  children,
}: {
  /** What the menu acts on: "More: Text Field: Town". */
  label: string;
  actions: ElementActions;
  trigger?: "button" | "context";
  children?: ReactNode;
}) {
  const items = actionItems(actions);
  if (items.length === 0) return children;
  if (trigger === "button") {
    return <MoreMenu items={items} subject={label} size="small" />;
  }
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger className="contents">{children}</ContextMenu.Trigger>
      <DropdownMenuContent aria-label={label} className="min-w-48">
        <MoreMenuItems items={items} />
      </DropdownMenuContent>
    </ContextMenu.Root>
  );
}
