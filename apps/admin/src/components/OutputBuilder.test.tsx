import type { FormSchema } from "@alliance/common/forms/form-schema";
import { SiteOriginLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { OutputBuilder } from "./OutputBuilder";

const renderBuilder = (
  schema: FormSchema,
  {
    onSchemaChange = () => {},
    selectedViewId = null,
  }: {
    onSchemaChange?: (schema: FormSchema) => void;
    selectedViewId?: string | null;
  } = {},
) =>
  render(
    <SiteOriginLinkProvider origin="https://worldalliance.org">
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <OutputBuilder
            schema={schema}
            onSchemaChange={onSchemaChange}
            onUpdateBlockById={() => null}
            editorsKey={0}
            selectedViewId={selectedViewId}
            onSelectView={() => {}}
          />
        </ToastProvider>
      </QueryClientProvider>
    </SiteOriginLinkProvider>,
  );

describe("OutputBuilder", () => {
  it("refuses to render a display block kind output views don't allow", () => {
    const schema: FormSchema = {
      pages: [{ id: "page-1", title: "One", fields: [] }],
      outputViews: [
        {
          type: "default",
          id: "view-1",
          blocks: [{ type: "display", kind: "video", id: "block-1", src: "" }],
        },
      ],
    };

    expect(() => renderBuilder(schema)).toThrow(
      "output views can't show video blocks",
    );
  });

  it("previews a list field as a row of sample cells", () => {
    const schema: FormSchema = {
      pages: [
        {
          id: "page-1",
          fields: [
            {
              id: "people",
              type: "input",
              kind: "list",
              label: "People",
              output: { output: true },
              fields: [
                { id: "email", type: "input", kind: "email", label: "Email" },
              ],
            },
          ],
        },
      ],
      outputViews: [
        {
          type: "default",
          id: "view-1",
          blocks: [{ id: "block-1", fieldId: "people" }],
        },
      ],
    };

    renderBuilder(schema);

    expect(screen.getByDisplayValue("user@example.com")).toBeTruthy();
  });

  describe("drag to reorder", () => {
    const schema: FormSchema = {
      pages: [{ id: "page-1", title: "One", fields: [] }],
      outputViews: [
        {
          type: "default",
          id: "view-1",
          blocks: ["A", "B", "C"].map((text) => ({
            type: "display" as const,
            kind: "header" as const,
            id: text,
            text,
          })),
        },
      ],
    };

    // The test DOM drops `clientY` from a drag event's init, and lays every
    // element out at zero, so -1 is above an element's midpoint and 1 below.
    const dragOverAt = (element: Element, clientY: number) => {
      const event = createEvent.dragOver(element, { dataTransfer: {} });
      Object.defineProperty(event, "clientY", { value: clientY });
      fireEvent(element, event);
    };

    const dragFirstOnto = (
      target: (handles: HTMLElement[]) => Element,
      clientY: number,
    ) => {
      const emitted: FormSchema[] = [];
      renderBuilder(schema, { onSchemaChange: (next) => emitted.push(next) });
      const handles = screen.getAllByTitle("Drag to reorder");
      fireEvent.dragStart(handles[0], { dataTransfer: {} });
      const zone = target(handles);
      dragOverAt(zone, clientY);
      fireEvent.drop(zone, { dataTransfer: {} });
      return emitted.at(-1)?.outputViews?.[0].blocks.map((block) => block.id);
    };

    it("moves a block before the one it's dropped on the top half of", () => {
      expect(dragFirstOnto((handles) => handles[2], -1)).toEqual([
        "B",
        "A",
        "C",
      ]);
    });

    it("moves a block after the one it's dropped on the bottom half of", () => {
      expect(dragFirstOnto((handles) => handles[2], 1)).toEqual([
        "B",
        "C",
        "A",
      ]);
    });

    it("moves a block to the end wherever it's dropped below the last one", () => {
      expect(
        dragFirstOnto((handles) => {
          let lastRow = handles[2];
          while (!lastRow.parentElement!.contains(handles[0]))
            lastRow = lastRow.parentElement!;
          return lastRow.nextElementSibling!;
        }, -1),
      ).toEqual(["B", "C", "A"]);
    });
  });

  describe("adding a block", () => {
    const schema: FormSchema = {
      pages: [
        {
          id: "page-1",
          fields: [
            {
              id: "name",
              type: "input",
              kind: "text",
              label: "Name",
              output: { output: true },
            },
          ],
        },
      ],
      outputViews: ["view-1", "view-2"].map((id) => ({
        type: "default" as const,
        id,
        blocks: [{ id: `${id}-block`, fieldId: "name" }],
      })),
    };

    const addedBlock = (add: () => void) => {
      const emitted: FormSchema[] = [];
      renderBuilder(schema, {
        onSchemaChange: (next) => emitted.push(next),
        selectedViewId: "view-2",
      });
      add();
      const [first, selected] = emitted.at(-1)?.outputViews ?? [];
      expect(first).toEqual(schema.outputViews?.[0]);
      expect(selected.blocks[0]).toEqual({
        id: "view-2-block",
        fieldId: "name",
      });
      expect(selected.blocks).toHaveLength(2);
      return selected.blocks[1];
    };

    it("appends a display block to the selected view", () => {
      const block = addedBlock(() =>
        fireEvent.change(screen.getByDisplayValue("Add display block…"), {
          target: { value: "header" },
        }),
      );
      expect(block).toMatchObject({ type: "display", kind: "header" });
    });

    it("appends an output field block for the first output field", () => {
      const block = addedBlock(() =>
        fireEvent.click(
          screen.getByRole("button", { name: "Add output field block" }),
        ),
      );
      expect(block).toMatchObject({ fieldId: "name", format: "field" });
    });
  });
});
