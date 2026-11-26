import type { ElementActions } from "../inspector/ElementActionsMenu";

/** For a context menu wrapped around rows or elements while the selection offers no actions there. */
export const NO_ACTIONS: ElementActions = {
  moveNoun: null,
  onMoveUp: null,
  onMoveDown: null,
  offersMoves: false,
  moveToPage: null,
  duplicateLabel: "Duplicate",
  onDuplicate: null,
  onAddBelow: null,
  editJsonLabel: "Edit element JSON…",
  onEditJson: null,
  onShowInOutline: null,
  deleteLabel: "",
  onDelete: null,
};
