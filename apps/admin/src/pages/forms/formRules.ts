import type { FormSummaryDto } from "@alliance/shared/client/types.gen";
import { countOf } from "../../lib/formatNumber";
import { formHref, taskHref } from "../../lib/hrefs";

export const formTitle = (form: Pick<FormSummaryDto, "id" | "title">) =>
  form.title || `Form ${form.id}`;

/** Where a form is built: its task's Form tab, or its own record. */
export const formBuilderHref = (
  form: Pick<FormSummaryDto, "id" | "usedInAction">,
) =>
  form.usedInAction
    ? taskHref(form.usedInAction.id, "form")
    : formHref(form.id);

export const matchesFormSearch = (form: FormSummaryDto, q: string) => {
  const needle = q.trim().toLowerCase();
  return (
    formTitle(form).toLowerCase().includes(needle) ||
    (form.usedInAction?.name.toLowerCase().includes(needle) ?? false)
  );
};

/**
 * What deleting a form does, as `deleteForm` in
 * `server/src/tasks/tasks.service.ts` and the foreign keys on `form` do it.
 */
export const deleteFormMessage = ({
  form,
  responseCount,
}: {
  form: Pick<FormSummaryDto, "usedInAction">;
  /** Undefined while the count is loading or when it failed. */
  responseCount: number | undefined;
}) => {
  const responses =
    responseCount === undefined
      ? "its responses"
      : responseCount === 0
        ? "its responses (none so far)"
        : `its ${countOf(responseCount, "response")}`;
  const lines = [
    `Deletes the form with ${responses}, the task completions those responses recorded, the drafts members have started and any follow-up form that uses it.`,
  ];
  if (form.usedInAction) {
    lines.push(
      `If this is the form of the task “${form.usedInAction.name}”, the task keeps pointing at it and the form stops loading, for members too. If it is one of the task's variants, the server refuses.`,
    );
  }
  lines.push(
    "The server also refuses while another form's formula reads this form's answers. No one is notified. The admin has no way to restore it.",
  );
  return lines.join("\n\n");
};
