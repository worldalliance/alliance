import type { FormSchema } from "@alliance/common/forms/form-schema";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react";
import { OutputBuilder } from "./OutputBuilder";

afterEach(cleanup);

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

    expect(() =>
      render(
        <QueryClientProvider client={new QueryClient()}>
          <ToastProvider>
            <OutputBuilder
              schema={schema}
              onSchemaChange={() => {}}
              onUpdateBlockById={() => null}
            />
          </ToastProvider>
        </QueryClientProvider>,
      ),
    ).toThrow("output views can't show video blocks");
  });
});
