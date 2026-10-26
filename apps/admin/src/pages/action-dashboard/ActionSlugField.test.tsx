import { actionsUpdateAdmin } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, spyOn } from "bun:test";
import { ActionSlugField } from "./ActionSlugField";

let saved: unknown[] = [];

serveApi(
  routes({
    "PATCH /actions/:id": async ({ request }) => {
      const body: { slug: string } = await request.json();
      if (body.slug === "taken") {
        return Response.json(
          { message: 'The slug "taken" is already taken' },
          { status: 409 },
        );
      }
      saved.push(body);
      return Response.json({});
    },
  }),
);

beforeEach(() => {
  saved = [];
});

const renderField = (slug = "food-bank") =>
  render(
    <ToastProvider>
      <ActionSlugField
        slug={slug}
        saving={false}
        onSave={(next) =>
          actionsUpdateAdmin({
            path: { id: 1 },
            body: { slug: next },
            throwOnError: true,
          })
        }
      />
    </ToastProvider>,
  );

const edit = (value: string) => {
  fireEvent.click(screen.getByRole("button", { name: "Edit slug" }));
  const input = screen.getByRole("textbox", { name: "Slug" });
  fireEvent.change(input, { target: { value } });
  return input;
};

it("saves an edited slug on Enter", async () => {
  renderField();
  fireEvent.keyDown(edit(" winter-drive "), { key: "Enter" });

  await waitFor(() => expect(saved).toEqual([{ slug: "winter-drive" }]));
  await waitFor(() =>
    expect(screen.queryByRole("textbox", { name: "Slug" })).toBeNull(),
  );
});

it("discards the edit on Escape", () => {
  renderField();
  fireEvent.keyDown(edit("winter-drive"), { key: "Escape" });

  expect(screen.getByRole("button", { name: "Edit slug" }).textContent).toBe(
    "food-bank",
  );
  expect(saved).toEqual([]);
});

it("keeps the input open with the server's refusal", async () => {
  const consoleError = spyOn(console, "error").mockImplementation(() => {});
  renderField();
  const input = edit("taken");
  fireEvent.keyDown(input, { key: "Enter" });

  await screen.findByText('The slug "taken" is already taken');
  expect(screen.getByRole("textbox", { name: "Slug" })).toBe(input);
  consoleError.mockRestore();
});

it("copies the slug", async () => {
  const writeText = spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  renderField();
  fireEvent.click(screen.getByRole("button", { name: "Copy slug" }));

  await waitFor(() => expect(writeText).toHaveBeenCalledWith("food-bank"));
  writeText.mockRestore();
});
