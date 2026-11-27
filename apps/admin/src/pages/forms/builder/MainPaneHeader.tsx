import { JsonScopeKind } from "../../../lib/formJson";
import { MoreMenu, type MoreMenuItem } from "../../../ui/MoreMenu";
import { ViewSwitch } from "../../../ui/templates/List";
import { PaneHeader } from "../../../ui/templates/Workspace";
import { useBuilder } from "./BuilderContext";
import { HEADER_TRUNCATES } from "./paneHeader";
import { HistoryControls } from "./save/HistoryControls";
import { pageTitle } from "./selection/canvasSelection";

enum Mode {
  Edit = "edit",
  Preview = "preview",
}

const MODES = [
  { id: Mode.Edit, label: "Edit" },
  { id: Mode.Preview, label: "Preview" },
];

/**
 * The header of the pane the builder works in: the page shown, undo and redo,
 * Edit and Preview on the Form tab, and a More menu that reaches pages, the
 * form's settings and its JSON with the outline hidden.
 */
export function MainPaneHeader({ title }: { title?: string }) {
  const builder = useBuilder();
  const {
    schema,
    selectedPageIndex,
    goToPage,
    isPreviewMode,
    requestPreview,
    showEdit,
    history,
    builderRef,
    setJsonScope,
    outline,
    canvas,
    edits,
    props: { displayOnly },
  } = builder;
  const pages = schema.pages;
  const onForm = title === undefined;

  const pageItems: MoreMenuItem[] = onForm
    ? [
        {
          label: "Previous page",
          onSelect: () => goToPage(selectedPageIndex - 1),
          ...(selectedPageIndex === 0 && {
            disabledReason: "This is the first page.",
          }),
        },
        {
          label: "Next page",
          onSelect: () => goToPage(selectedPageIndex + 1),
          ...(selectedPageIndex === pages.length - 1 && {
            disabledReason: "This is the last page.",
          }),
        },
        ...pages.map((page, index) => ({
          label: `Go to page ${index + 1}: ${pageTitle(page)}`,
          onSelect: () => goToPage(index),
          ...(index === selectedPageIndex && {
            disabledReason: "Shown now.",
          }),
        })),
      ]
    : [];
  const items: MoreMenuItem[] = [
    ...(pages.length > 1 ? pageItems : []),
    ...(onForm && !displayOnly && !isPreviewMode
      ? [{ label: "Add page", onSelect: edits.addPage }]
      : []),
    ...(onForm && !isPreviewMode
      ? [{ label: "Form settings", onSelect: canvas.selectForm }]
      : []),
    ...(isPreviewMode
      ? []
      : [
          {
            label: "Edit form JSON…",
            onSelect: () => setJsonScope({ kind: JsonScopeKind.Form }),
          },
        ]),
    ...(onForm
      ? [
          {
            label: outline.hidden ? "Show outline" : "Hide outline",
            onSelect: outline.toggle,
          },
        ]
      : []),
  ];

  const heading =
    title ??
    `${isPreviewMode ? "Preview: page" : "Page"} ${selectedPageIndex + 1} of ${pages.length}`;

  return (
    <PaneHeader
      title={heading}
      className={HEADER_TRUNCATES}
      action={
        <div className="flex shrink-0 items-center gap-1">
          <HistoryControls
            scope={builderRef}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            onUndo={history.undo}
            onRedo={history.redo}
          />
          {onForm && (
            <ViewSwitch
              label="Mode"
              items={MODES}
              value={isPreviewMode ? Mode.Preview : Mode.Edit}
              onChange={(mode) =>
                mode === Mode.Preview ? requestPreview() : showEdit()
              }
            />
          )}
          <MoreMenu items={items} size="small" />
        </div>
      }
    />
  );
}
