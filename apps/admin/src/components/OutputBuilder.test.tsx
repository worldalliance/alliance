import type { FormSchema } from "@alliance/common/forms/form-schema";
import { AuthoredLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { OutputBuilder } from "./OutputBuilder";

afterEach(cleanup);

const renderBuilder = (schema: FormSchema) =>
  render(
    <AuthoredLinkProvider>
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <OutputBuilder
            schema={schema}
            onSchemaChange={() => {}}
            onUpdateBlockById={() => null}
          />
        </ToastProvider>
      </QueryClientProvider>
    </AuthoredLinkProvider>,
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
});
