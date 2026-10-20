import type { FormSchema } from "@alliance/common/forms/form-schema";
import { SiteOriginLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { OutputBuilder } from "./OutputBuilder";

afterEach(cleanup);

const renderBuilder = (
  schema: FormSchema,
  onSchemaChange: (schema: FormSchema) => void = () => {},
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
            selectedViewId={null}
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
      renderBuilder(schema, (next) => emitted.push(next));
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
});
