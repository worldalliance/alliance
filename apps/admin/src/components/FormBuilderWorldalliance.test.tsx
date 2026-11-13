import type { FormSchema } from "@alliance/common/forms/form-schema";
import { client } from "@alliance/shared/client/client.gen";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";

const linkingOldDomain: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "town",
          type: "input",
          kind: "text",
          label: "See [Settings](https://worldalliance.org/settings)",
        },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

describe("FormBuilder save with worldalliance text", () => {
  const { baseUrl, fetch } = client.getConfig();
  afterEach(() => client.setConfig({ baseUrl, fetch }));

  const recordWrites = (): string[] => {
    const writes: string[] = [];
    client.setConfig({
      baseUrl: "http://localhost",
      fetch: async (request: Request) => {
        const { pathname } = new URL(request.url);
        if (request.method !== "GET") {
          writes.push(pathname);
          return Response.json({
            id: 1,
            schema: linkingOldDomain,
            formSnapshotId: 2,
          });
        }
        return pathname === "/tasks/listForms"
          ? Response.json([])
          : Response.json({
              id: 1,
              schema: linkingOldDomain,
              formSnapshotId: 1,
            });
      },
    });
    return writes;
  };

  it("saves once the admin chooses Save anyway", async () => {
    const writes = recordWrites();
    renderFormBuilder(linkingOldDomain, 1);
    fireEvent.change(screen.getByPlaceholderText("Page title"), {
      target: { value: "Where" },
    });

    fireEvent.click(screen.getByText("Save Form"));
    expect((await screen.findByRole("dialog")).textContent).toContain(
      "https://worldalliance.org/settings",
    );
    expect(writes).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Save anyway" }));

    await waitFor(() => expect(writes).toHaveLength(1));
  });

  it("saves nothing when the admin cancels", async () => {
    const writes = recordWrites();
    renderFormBuilder(linkingOldDomain, 1);
    fireEvent.change(screen.getByPlaceholderText("Page title"), {
      target: { value: "Where" },
    });

    fireEvent.click(screen.getByText("Save Form"));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(writes).toEqual([]);
  });

  it("asks about worldalliance text after unmatched variable references are confirmed", async () => {
    const writes = recordWrites();
    const withUnmatchedVariable: FormSchema = {
      ...linkingOldDomain,
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "town",
              type: "input",
              kind: "text",
              label: "Hi #{nobody}, see https://worldalliance.org/settings",
            },
          ],
        },
      ],
    };
    renderFormBuilder(withUnmatchedVariable, 1);
    fireEvent.change(screen.getByPlaceholderText("Page title"), {
      target: { value: "Where" },
    });

    fireEvent.click(screen.getByText("Save Form"));
    expect((await screen.findByRole("dialog")).textContent).toContain(
      "#{nobody}",
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect((await screen.findByRole("dialog")).textContent).toContain(
      "Save with worldalliance text?",
    );
    expect(writes).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Save anyway" }));

    await waitFor(() => expect(writes).toHaveLength(1));
  });
});
