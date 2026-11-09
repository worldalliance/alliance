import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "bun:test";
import FormSlugEditor from "./FormSlugEditor";

let slug = "v2";
let renamed: unknown[] = [];

serveApi(
  routes({
    "GET /tasks/listForms": () =>
      Response.json([
        {
          id: 164,
          title: "Survey",
          slug,
          displaySlug: `grantmaking-prep-2::${slug}`,
        },
      ]),
    "PATCH /tasks/forms/:formId/slug": async ({ request, params }) => {
      const body: { slug: string } = await request.json();
      if (body.slug === "v1") {
        return Response.json(
          { message: 'The slug "v1" is already taken' },
          { status: 409 },
        );
      }
      renamed.push({ formId: params.formId, ...body });
      slug = body.slug;
      return Response.json({});
    },
  }),
);

beforeEach(() => {
  slug = "v2";
  renamed = [];
});

const renderEditor = () =>
  render(
    <ToastProvider>
      <FormSlugEditor formId={164} />
    </ToastProvider>,
    queryWrapper(),
  );

const edit = async (value: string) => {
  fireEvent.click(await screen.findByRole("button", { name: "Edit slug" }));
  const input = screen.getByRole("textbox", { name: "Slug" });
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
};

it("shows the action slug before the form's own", async () => {
  renderEditor();
  expect(await screen.findByText("grantmaking-prep-2::")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Edit slug" }).textContent).toBe(
    "v2",
  );
});

it("renames the slug and shows the refetched one", async () => {
  renderEditor();
  await edit("control");
  await waitFor(() =>
    expect(renamed).toEqual([{ formId: "164", slug: "control" }]),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Edit slug" }).textContent).toBe(
      "control",
    ),
  );
});

it("keeps the draft open with the server's refusal", async () => {
  renderEditor();
  await edit("v1");
  expect(
    await screen.findByText('The slug "v1" is already taken'),
  ).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Slug" })).toBeTruthy();
});
