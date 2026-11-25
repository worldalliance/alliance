import type { CreateActionDto } from "@alliance/shared/client";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ActionForm from "../../components/ActionForm";
import { createActionForm } from "./createActionForm";

const baseForm = createActionForm({
  body: "Intro",
  optional: true,
  customStatType: "users_invited",
  timeEstimate: 10,
});

type ActionFormProps = React.ComponentProps<typeof ActionForm>;

export const renderForm = (
  params: {
    form?: Partial<CreateActionDto>;
    props?: Partial<ActionFormProps>;
  } = {},
) => {
  const edits: [string, string | boolean][] = [];
  const onInputChange = jest.fn(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const { target } = e;
      edits.push([
        target.name,
        target instanceof HTMLInputElement && target.type === "checkbox"
          ? target.checked
          : target.value,
      ]);
    },
  );
  const onImageChange = jest.fn();
  const onCategoryChange = jest.fn();
  const client = new QueryClient();
  const ui = (props?: Partial<ActionFormProps>) => (
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <ActionForm
            form={{ ...baseForm, ...params.form }}
            onInputChange={onInputChange}
            onImageChange={onImageChange}
            onSubmit={jest.fn()}
            saving={false}
            imagePreview={null}
            onCancelImageUpload={jest.fn()}
            isNew={true}
            tagsLoading={false}
            tagsError={false}
            suitesLoading={false}
            suitesError={false}
            usersLoading={false}
            usersError={false}
            cohortExpression={null}
            onCohortExpressionChange={jest.fn()}
            onPrerequisitesChange={jest.fn()}
            authorIds={[]}
            onAuthorsChange={jest.fn()}
            onCategoryChange={onCategoryChange}
            reviewers={[]}
            onReviewersChange={jest.fn()}
            allActionsLoadFailed={false}
            memberActionStart={null}
            memberActionDeadline={null}
            {...props}
          />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  const { rerender } = render(ui(params.props));
  return {
    edits,
    onImageChange,
    onCategoryChange,
    rerender: (props: Partial<ActionFormProps>) =>
      rerender(ui({ ...params.props, ...props })),
  };
};

export const section = (title: string) => {
  const heading = screen.getByRole("heading", { name: title });
  const toggle = heading.querySelector("button[aria-controls]");
  const container = toggle
    ? document.getElementById(toggle.getAttribute("aria-controls") ?? "")
    : heading.parentElement?.parentElement;
  if (!container) throw new Error(`no section for ${title}`);
  return container;
};

export const fieldNames = (title: string) =>
  Array.from(section(title).querySelectorAll("[name]"), (el) =>
    el.getAttribute("name"),
  );

export const fieldKinds = (title: string) =>
  Array.from(section(title).querySelectorAll("[name]"), (el) =>
    el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase(),
  );

export const gridNames = (title: string) =>
  Array.from(section(title).querySelectorAll(".grid"), (grid) =>
    Array.from(grid.querySelectorAll("[name]"), (el) =>
      el.getAttribute("name"),
    ),
  ).filter((names) => names.length > 0);

export const leafTexts = (title: string) =>
  Array.from(section(title).querySelectorAll("label, p, span"))
    .filter((el) => el.childElementCount === 0 && !el.closest("[aria-hidden]"))
    .map((el) => el.textContent);

export const options = (name: string) =>
  Array.from(
    screen.getByRole<HTMLSelectElement>("combobox", { name }).options,
    (option) => [option.value, option.textContent],
  );
