import { CopyTextFormat } from "@alliance/common/forms/display-blocks";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import { client } from "@alliance/shared/client/client.gen";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";
import { isResponseCountsRead } from "../lib/testing/responseCounts";

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

describe("FormBuilder save with worldalliance text or site links", () => {
  const { baseUrl, fetch } = client.getConfig();
  afterEach(() => client.setConfig({ baseUrl, fetch }));

  const recordWrites = (): string[] => {
    const writes: string[] = [];
    client.setConfig({
      baseUrl: "http://localhost",
      fetch: async (request: Request) => {
        if (isResponseCountsRead(request)) return Response.json([]);
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

    fireEvent.click(screen.getByText("Save form"));
    expect((await screen.findByRole("dialog")).textContent).toContain(
      "https://worldalliance.org/settings",
    );
    expect(writes).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Save anyway" }));

    await waitFor(() => expect(writes).toHaveLength(1));
  });

  it("asks before saving an absolute link to the site", async () => {
    const writes = recordWrites();
    const linkingSite: FormSchema = {
      ...linkingOldDomain,
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "town",
              type: "input",
              kind: "text",
              label: "See [it](https://thealliance.org/actions/53)",
            },
          ],
        },
      ],
    };
    renderFormBuilder(linkingSite, 1);
    fireEvent.change(screen.getByPlaceholderText("Page title"), {
      target: { value: "Where" },
    });

    fireEvent.click(screen.getByText("Save form"));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Links to the site should be paths");
    expect(dialog.textContent).toContain("https://thealliance.org/actions/53");
    expect(writes).toEqual([]);
  });

  it("saves share text, plain text fields in pages and output views, plain copy text, descriptions, answer defaults, placeholders, aggregate views, contract text and row values used outside a link destination without asking", async () => {
    const writes = recordWrites();
    const link = "https://thealliance.org/join";
    renderFormBuilder(
      {
        ...linkingOldDomain,
        rowList: { rows: [{ invite: link }], keyFields: ["invite"] },
        outputViews: [
          {
            id: "out",
            type: "default",
            blocks: [
              { id: "out-head", type: "display", kind: "header", text: link },
              {
                id: "out-copy",
                type: "display",
                kind: "copytext",
                text: "#{row.invite}",
              },
            ],
          },
        ],
        aggregateViews: [
          {
            kind: "progressbar",
            id: "goal",
            title: link,
            caption: link,
            numerator: { type: "number", value: 1 },
            denominator: { type: "number", value: 1 },
            displayType: "number",
          },
        ],
        shareableTextTemplate: `Join me: ${link}`,
        defaultShareableTextTemplate: `Join me: ${link}`,
        pages: [
          {
            id: "p1",
            fields: [
              { id: "copy", type: "display", kind: "copytext", text: link },
              {
                id: "row-text",
                type: "display",
                kind: "text",
                text: "![](#{row.invite})",
              },
              { id: "head", type: "display", kind: "header", text: link },
              { id: "note", type: "display", kind: "label", text: link },
              {
                id: "go",
                type: "display",
                kind: "biglink",
                text: link,
                body: link,
                url: "/join",
              },
              {
                id: "site",
                type: "input",
                kind: "text",
                label: "Website",
                description: link,
                placeholder: link,
                defaultValue: link,
              },
              {
                id: "terms",
                type: "input",
                kind: "contract",
                label: null,
                contractId: 1,
                contract: { id: 1, markdown: `See ${link}` },
                signQuestion: "Sign?",
                yesLabel: "Yes",
                noLabel: "No",
              },
            ],
          },
        ],
      },
      1,
    );
    fireEvent.change(screen.getByPlaceholderText("Page title"), {
      target: { value: "Where" },
    });

    fireEvent.click(screen.getByText("Save form"));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks about text, quotes, chat transcripts, markdown copy text, big link urls, and accordion and output view text linking the site", async () => {
    const writes = recordWrites();
    renderFormBuilder(
      {
        ...linkingOldDomain,
        outputViews: [
          {
            id: "out",
            type: "default",
            blocks: [
              {
                id: "out-text",
                type: "display",
                kind: "text",
                text: "https://thealliance.org/output",
              },
            ],
          },
        ],
        pages: [
          {
            id: "p1",
            fields: [
              {
                id: "copy",
                type: "display",
                kind: "copytext",
                format: CopyTextFormat.Markdown,
                text: "[Copy](https://thealliance.org/copy)",
              },
              {
                id: "go",
                type: "display",
                kind: "biglink",
                text: "Go",
                url: "//thealliance.org/biglink",
              },
              {
                id: "said",
                type: "display",
                kind: "quote",
                text: "https://thealliance.org/quote",
              },
              {
                id: "chat",
                type: "display",
                kind: "chatTranscript",
                messages: [
                  { side: "left", text: "https://thealliance.org/chat" },
                ],
              },
              {
                id: "faq",
                type: "display",
                kind: "accordion",
                sections: [
                  {
                    id: "s1",
                    title: "More",
                    blocks: [
                      {
                        id: "faq-text",
                        type: "display",
                        kind: "text",
                        text: "https://thealliance.org/accordion",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      1,
    );
    fireEvent.change(screen.getByPlaceholderText("Page title"), {
      target: { value: "Where" },
    });

    fireEvent.click(screen.getByText("Save form"));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("https://thealliance.org/quote");
    expect(dialog.textContent).toContain("https://thealliance.org/chat");
    expect(dialog.textContent).toContain("https://thealliance.org/copy");
    expect(dialog.textContent).toContain("//thealliance.org/biglink");
    expect(dialog.textContent).toContain("https://thealliance.org/accordion");
    expect(dialog.textContent).toContain("https://thealliance.org/output");
    expect(writes).toEqual([]);
  });

  it("asks about row values that start a link's destination, bare urls the mobile app links included, listing each url once", async () => {
    const writes = recordWrites();
    renderFormBuilder(
      {
        ...linkingOldDomain,
        rowList: {
          rows: [
            {
              invite: "https://thealliance.org/join",
              more: "https://worldalliance.org/more",
              plain: "https://thealliance.org/plain",
              tracked: "https://thealliance.org/tracked",
              label: "https://thealliance.org/label",
              site: "https://thealliance.org/site",
            },
            {
              invite: "https://thealliance.org/join",
              more: "https://example.com/more",
              plain: "https://thealliance.org/plain",
            },
          ],
          keyFields: ["invite", "more"],
        },
        pages: [
          {
            id: "p1",
            fields: [
              {
                id: "go",
                type: "display",
                kind: "biglink",
                text: "Join",
                url: "#{row.invite}",
              },
              {
                id: "read",
                type: "display",
                kind: "text",
                text: "[More](#{row.more}) or #{row.plain}",
              },
              {
                id: "tracked",
                type: "display",
                kind: "text",
                text: "[Go](#{row.tracked}?source=form) [Docs](#{row.site}docs)",
              },
              {
                id: "name",
                type: "input",
                kind: "text",
                label: "Your page: #{row.label}",
              },
            ],
          },
        ],
      },
      1,
    );
    fireEvent.change(screen.getByPlaceholderText("Page title"), {
      target: { value: "Where" },
    });

    fireEvent.click(screen.getByText("Save form"));
    const dialog = await screen.findByRole("dialog");
    const text = dialog.textContent ?? "";
    expect(text.split("https://thealliance.org/join")).toHaveLength(2);
    expect(text).toContain("https://worldalliance.org/more");
    expect(text).not.toContain("This mentions worldalliance");
    expect(text.split("https://thealliance.org/plain")).toHaveLength(2);
    expect(text).toContain("https://thealliance.org/tracked");
    expect(text).toContain("https://thealliance.org/site");
    expect(text).not.toContain("https://thealliance.org/label");
    expect(writes).toEqual([]);
  });

  it("saves nothing when the admin cancels", async () => {
    const writes = recordWrites();
    renderFormBuilder(linkingOldDomain, 1);
    fireEvent.change(screen.getByPlaceholderText("Page title"), {
      target: { value: "Where" },
    });

    fireEvent.click(screen.getByText("Save form"));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(writes).toEqual([]);
  });

  it("asks about site links after unmatched variable references are confirmed", async () => {
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
              label:
                "Hi #{nobody}, see [settings](https://worldalliance.org/settings)",
            },
          ],
        },
      ],
    };
    renderFormBuilder(withUnmatchedVariable, 1);
    fireEvent.change(screen.getByPlaceholderText("Page title"), {
      target: { value: "Where" },
    });

    fireEvent.click(screen.getByText("Save form"));
    expect((await screen.findByRole("dialog")).textContent).toContain(
      "#{nobody}",
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect((await screen.findByRole("dialog")).textContent).toContain(
      "Links to the site should be paths",
    );
    expect(writes).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Save anyway" }));

    await waitFor(() => expect(writes).toHaveLength(1));
  });
});
